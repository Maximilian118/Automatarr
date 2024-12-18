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
    // Simplified Console transport without colorization
    new transports.Console({
      format: format.combine(
        format.timestamp({ format: timestampFormat }),
        format.printf(({ timestamp, level, message }) => {
          return `[${timestamp}] [${level.toUpperCase()}] ${message}`
        }),
      ),
    }),

    // Daily rotated file for application logs (info, debug, etc.)
    new DailyRotateFile({
      filename: path.join(logDirectory, "application-%DATE%.log"),
      level: "info",
      datePattern: "DD-MM-YYYY",
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
      datePattern: "DD-MM-YYYY",
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
      datePattern: "DD-MM-YYYY",
      maxFiles: "5d",
      format: format.combine(
        format.printf(({ timestamp, level, message }) => {
          return `[${timestamp}] [${level.toUpperCase()}] ${message}`
        }),
      ),
    }),
  ],
})

export default logger
