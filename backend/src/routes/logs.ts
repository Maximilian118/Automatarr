import express from "express"
import fs from "fs"
import path from "path"
import { Tail } from "tail"
import moment from "moment"

const router = express.Router()

// Get log directory
const logDirectory = path.join(__dirname, "..", "..", "..", "automatarr_logs")

// Get current log file name
const getCurrentLogFileName = (): string => {
  const today = moment().format("DD-MM-YYYY")
  return `combined-${today}.log`
}

// Parse a log line into structured format
const parseLogLine = (line: string) => {
  // Match format: [DD-MM-YYYY HH:mm:ss] [EMOJI LEVEL] message
  const logRegex = /^\[([^\]]+)\] \[([^\]]+)\] (.+)$/
  const match = line.match(logRegex)
  
  if (match) {
    const [, timestamp, levelWithEmoji, message] = match
    // Extract level from emoji+level format (e.g., "✅ SUCCESS" -> "SUCCESS")
    const level = levelWithEmoji.split(" ").slice(1).join(" ")
    
    return {
      timestamp: moment(timestamp, "DD-MM-YYYY HH:mm:ss").toISOString(),
      level: level.toLowerCase(),
      message: message.trim()
    }
  }
  
  // If line doesn't match expected format, return as-is
  return {
    timestamp: new Date().toISOString(),
    level: "info",
    message: line
  }
}

// Read recent logs from file
const readRecentLogs = async (lines: number = 100): Promise<any[]> => {
  const logFile = path.join(logDirectory, getCurrentLogFileName())
  
  try {
    if (!fs.existsSync(logFile)) {
      return []
    }
    
    const data = fs.readFileSync(logFile, "utf8")
    const allLines = data.split("\n").filter(line => line.trim() !== "")
    
    // Get last N lines
    const recentLines = allLines.slice(-lines)
    
    return recentLines.map(parseLogLine)
  } catch (error) {
    console.error("Error reading log file:", error)
    return []
  }
}

// GET /api/logs - Get recent log entries
router.get("/", async (req, res) => {
  try {
    const lines = parseInt(req.query.lines as string) || 100
    const logs = await readRecentLogs(lines)
    
    res.json({
      logs,
      total: logs.length
    })
  } catch (error) {
    console.error("Error fetching logs:", error)
    res.status(500).json({ error: "Failed to fetch logs" })
  }
})

// GET /api/logs/stream - Stream real-time logs via Server-Sent Events
router.get("/stream", (req, res) => {
  // Set headers for Server-Sent Events
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    "Connection": "keep-alive",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Cache-Control"
  })

  const logFile = path.join(logDirectory, getCurrentLogFileName())
  
  // Create tail instance to watch log file
  let tail: any = null
  
  try {
    // Only start tailing if file exists
    if (fs.existsSync(logFile)) {
      tail = new Tail(logFile, { follow: true, fromBeginning: false })
      
      tail.on("line", (line: string) => {
        if (line.trim()) {
          const logEntry = parseLogLine(line)
          res.write(`data: ${JSON.stringify(logEntry)}\n\n`)
        }
      })
      
      tail.on("error", (error: any) => {
        console.error("Tail error:", error)
      })
    }
  } catch (error) {
    console.error("Error setting up log tail:", error)
  }
  
  // Send heartbeat every 30 seconds to keep connection alive
  const heartbeat = setInterval(() => {
    res.write(": heartbeat\n\n")
  }, 30000)
  
  // Clean up on client disconnect
  req.on("close", () => {
    if (tail) {
      tail.unwatch()
    }
    clearInterval(heartbeat)
  })
  
  req.on("error", () => {
    if (tail) {
      tail.unwatch()
    }
    clearInterval(heartbeat)
  })
})

export default router