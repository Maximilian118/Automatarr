import winston, { format, transports } from "winston"
import moment from "moment"
import path from "path"
import fs from "fs"
import DailyRotateFile from "winston-daily-rotate-file"

// Create log directory if it doesn't exist
const logDirectory = path.join(__dirname, "..", "..", "automatarr_logs")
if (!fs.existsSync(logDirectory)) {
  fs.mkdirSync(logDirectory)
}

// Custom timestamp format
const timestampFormat = () => moment().format("DD-MM-YYYY HH:mm:ss")

// Custom levels and colors
const customLevels = {
  levels: {
    catastrophic: 0,
    error: 1,
    warn: 2,
    success: 3,
    loop: 4,
    info: 5,
    debug: 6,
  },
  colors: {
    catastrophic: "magenta",
    error: "red",
    warn: "yellow",
    success: "green",
    loop: "cyan",
    info: "blue",
    debug: "gray",
  },
}

// Emoji mapping
const emojiMap: Record<string, string> = {
  catastrophic: "💀",
  error: "❌",
  warn: "⚠️",
  success: "✅",
  loop: "🔄",
  info: "ℹ️",
  debug: "🐞",
}

// Custom formatter
const customFormat = format.printf(({ timestamp, level, message }) => {
  const emoji = emojiMap[level] || ""
  const upperLevel = level.toUpperCase()
  return `[${timestamp}] [${emoji} ${upperLevel}] ${message}`
})

// Filter to allow only specific log levels
const debugFilter = format((info) => {
  const allowedLevels = ["catastrophic", "error", "warn", "debug"]
  return allowedLevels.includes(info.level) ? info : false
})

// Filter for auth-related messages
const authFilter = format((info) => {
  if (typeof info.message === "string" && info.message.toLowerCase().startsWith("auth |")) {
    return info
  }
  return false
})

// Create the logger
const logger = winston.createLogger({
  levels: customLevels.levels,
  level: "debug",
  format: format.combine(format.timestamp({ format: timestampFormat }), customFormat),
  transports: [
    new transports.Console(),

    new DailyRotateFile({
      filename: path.join(logDirectory, "application-%DATE%.log"),
      level: "debug",
      datePattern: "DD-MM-YYYY",
      maxFiles: "5d",
    }),

    new DailyRotateFile({
      filename: path.join(logDirectory, "error-%DATE%.log"),
      level: "warn",
      datePattern: "DD-MM-YYYY",
      maxFiles: "14d",
    }),

    new DailyRotateFile({
      filename: path.join(logDirectory, "combined-%DATE%.log"),
      level: "debug",
      datePattern: "DD-MM-YYYY",
      maxFiles: "5d",
    }),

    new DailyRotateFile({
      filename: path.join(logDirectory, "debug-filtered-%DATE%.log"),
      level: "debug",
      datePattern: "DD-MM-YYYY",
      maxFiles: "7d",
      format: format.combine(
        debugFilter(),
        format.timestamp({ format: timestampFormat }),
        customFormat,
      ),
    }),

    new DailyRotateFile({
      filename: path.join(logDirectory, "auth-%DATE%.log"),
      level: "debug",
      datePattern: "DD-MM-YYYY",
      maxFiles: "14d",
      format: format.combine(
        authFilter(),
        format.timestamp({ format: timestampFormat }),
        customFormat,
      ),
    }),
  ],
})

// Enable color output in console
winston.addColors(customLevels.colors)

// --- Extend logger type to include custom methods ---
interface CustomLogger extends winston.Logger {
  success: (message: string) => void
  catastrophic: (message: string) => void
  loop: (message: string) => void
}

// --- Cast the logger to the extended type ---
const typedLogger = logger as CustomLogger

// --- Add custom level methods ---
typedLogger.success = (message: string) => typedLogger.log("success", message)
typedLogger.catastrophic = (message: string) => typedLogger.log("catastrophic", message)
typedLogger.loop = (message: string) => typedLogger.log("loop", message)

export default typedLogger
