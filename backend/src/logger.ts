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

// Custom formatter with emojis
const customFormat = format.printf(({ timestamp, level, message }) => {
  const emoji = emojiMap[level] || ""
  const upperLevel = level.toUpperCase()
  return `[${timestamp}] [${emoji} ${upperLevel}] ${message}`
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

export default typedLogger
