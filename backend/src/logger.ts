import winston, { format, transports } from "winston"
import moment from "moment"
import path from "path"
import fs from "fs"
import DailyRotateFile from "winston-daily-rotate-file"

// Define the log directory path
const logDirectory = path.join(__dirname, "..", "..", "automatarr_logs")

// Create the log directory if it doesn't exist
if (!fs.existsSync(logDirectory)) {
  fs.mkdirSync(logDirectory)
}

// Custom timestamp format using moment.js
const timestampFormat = () => moment().format("DD-MM-YYYY HH:mm:ss")

// Create the Winston logger instance
const logger = winston.createLogger({
  level: "info", // Default log level
  format: format.combine(
    format.timestamp({ format: timestampFormat }),
    format.printf(({ timestamp, level, message }) => {
      return `[${timestamp}] [${level.toUpperCase()}] ${message}`
    }),
  ),
  transports: [
    // Console transport with colorized output
    new transports.Console({
      format: format.combine(
        format.colorize(), // Colorize the output
        format.printf(({ timestamp, level, message }) => {
          return `[${timestamp}] [${level.toUpperCase()}] ${message}`
        }),
      ),
    }),

    // Daily rotated file for application logs (info, debug, etc.)
    new DailyRotateFile({
      filename: path.join(logDirectory, "application-%DATE%.log"),
      level: "info",
      datePattern: "YYYY-MM-DD",
      maxFiles: "5d",
      format: format.combine(
        format.printf(({ timestamp, level, message }) => {
          return `[${timestamp}] [${level.toUpperCase()}] ${message}`
        }),
      ),
    }),

    // Daily rotated file for error and warning logs
    new DailyRotateFile({
      filename: path.join(logDirectory, "error-%DATE%.log"),
      level: "warn", // and 'error'
      datePattern: "YYYY-MM-DD",
      maxFiles: "14d",
      format: format.combine(
        format.printf(({ timestamp, level, message }) => {
          return `[${timestamp}] [${level.toUpperCase()}] ${message}`
        }),
      ),
    }),

    // Daily rotated file for combined logs (everything)
    new DailyRotateFile({
      filename: path.join(logDirectory, "combined-%DATE%.log"),
      datePattern: "YYYY-MM-DD",
      maxFiles: "5d",
      format: format.combine(
        format.printf(({ timestamp, level, message }) => {
          return `[${timestamp}] [${level.toUpperCase()}] ${message}`
        }),
      ),
    }),
  ],
})

// Example of logging messages with different levels
// logger.info("This is an info message")
// logger.error("This is an error message")
// logger.warn("This is a warning message")
// logger.debug("This is a debug message")

export default logger
