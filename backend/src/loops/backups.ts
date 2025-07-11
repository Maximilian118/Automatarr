import { settingsType } from "../models/settings"
import logger from "../logger"
import { isDocker } from "../shared/fileSystem"
import { checkPermissions } from "../shared/permissions"
import fs from "fs"
import path from "path"

const BACKUP_DIR = "/app/automatarr_backups"

/**
 * Safely removes all `_id` and `__v` fields from a deeply nested object or array.
 * Handles large structures and circular references without blowing the call stack.
 */
export const removeMongoIds = (input: any): any => {
  if (input === null || typeof input !== "object") return input

  const seen = new WeakMap<object, any>()
  const root: any = Array.isArray(input) ? [] : {}
  seen.set(input, root)

  const stack = [{ source: input, target: root }]

  while (stack.length > 0) {
    const { source, target } = stack.pop()!

    for (const key in source) {
      if (key === "_id" || key === "__v") continue

      const value = source[key]

      // Preserve original reference for non-plain objects (Date, Buffer, ObjectId, etc.)
      if (value && typeof value === "object" && Object.getPrototypeOf(value) === Object.prototype) {
        if (seen.has(value)) {
          target[key] = seen.get(value)
        } else {
          const clone = Array.isArray(value) ? [] : {}
          seen.set(value, clone)
          target[key] = clone
          stack.push({ source: value, target: clone })
        }
      } else {
        target[key] = value
      }
    }
  }

  return root
}

export const backups = async (settings: settingsType): Promise<void> => {
  // Check if we're running in a docker container
  if (!isDocker) {
    logger.info("Backups | Bypassed. In Development mode. 🔧")
    return
  }

  // Ensure backups are enabled
  if (!settings.backups) {
    logger.info("Backups | Inactive.")
    return
  }

  // Create the backup dir if it doesn't exist
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true })
    logger.success("Backups | Created backup directory.")
  }

  // Check permissions for the backup path
  if (!checkPermissions(BACKUP_DIR, ["all"], "Backups", false)) {
    logger.error(`Backups | Insufficient permissions for backup path: ${BACKUP_DIR}`)
    return
  }

  try {
    // Check if a recent backup was already created
    const loopMinutes = settings.backups_loop ?? 1440 // Default: 1 day
    const loopThresholdMs = loopMinutes * 60 * 1000
    const now = Date.now()

    const files = fs
      .readdirSync(BACKUP_DIR)
      .filter((f) => f.endsWith("-settings.json"))
      .sort((a, b) => {
        const aTime = fs.statSync(path.join(BACKUP_DIR, a)).mtime.getTime()
        const bTime = fs.statSync(path.join(BACKUP_DIR, b)).mtime.getTime()
        return bTime - aTime // newest first
      })

    if (files.length > 0) {
      const latestFile = files[0]
      const latestFilePath = path.join(BACKUP_DIR, latestFile)
      const latestMtime = fs.statSync(latestFilePath).mtime.getTime()

      if (now - latestMtime < loopThresholdMs) {
        logger.info("Backups | Latest file is too recent.")
        return
      }
    }

    // Create the backup settings object
    const { __v, ...topLevelClean } = settings
    const fullyClean = removeMongoIds(topLevelClean)

    if (!fullyClean) {
      logger.error("Backups | Failed to clean settings object")
      return
    }

    // Generate timestamped filename
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-")
    const filename = `${timestamp}-settings.json`
    const fullPath = path.join(BACKUP_DIR, filename)

    // Write the backup file
    fs.writeFileSync(fullPath, JSON.stringify(fullyClean, null, 2), "utf-8")
    logger.success("Backups | Backup Saved!")

    // Cleanup: Remove old backup files
    const rotationThresholdMins = settings.backups_rotation_date ?? 525600 // Default: 1 year
    const rotationThresholdMs = rotationThresholdMins * 60 * 1000

    for (const file of files) {
      const filePath = path.join(BACKUP_DIR, file)

      try {
        const stats = fs.statSync(filePath)
        const fileAgeMs = now - stats.mtime.getTime()

        if (fileAgeMs > rotationThresholdMs) {
          fs.unlinkSync(filePath)
          logger.info(`Backups | Removed old backup: ${file}`)
        }
      } catch (err) {
        logger.error(`Backups | Error while processing file ${file}: ${err}`)
      }
    }
  } catch (err) {
    logger.error(`Backups | Failed to write backup: ${err}`)
  }
}

export default backups

// Return an array of backup file names
export const readBackups = (): string[] => {
  const timestampRegex = /^(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z)/

  try {
    if (!fs.existsSync(BACKUP_DIR)) {
      logger.warn(`ReadBackups | Backup directory does not exist: ${BACKUP_DIR}`)
      return []
    }

    const files = fs.readdirSync(BACKUP_DIR)

    const sorted = files
      .map((file) => ({
        name: file,
        timestamp: file.match(timestampRegex)?.[1] ?? "",
      }))
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
      .map((f) => f.name)

    logger.info(`ReadBackups | Found ${sorted.length} backup file(s).`)
    return sorted
  } catch (err) {
    logger.error(`ReadBackups | Failed to read backup directory: ${err}`)
    return []
  }
}

// find and parse a backup file
export const loadBackupFile = (fileName: string): settingsType => {
  const filePath = path.join(BACKUP_DIR, fileName)

  if (!fs.existsSync(filePath)) {
    throw new Error(`Backup file "${fileName}" not found`)
  }

  const raw = fs.readFileSync(filePath, "utf-8")
  return JSON.parse(raw) as settingsType
}
