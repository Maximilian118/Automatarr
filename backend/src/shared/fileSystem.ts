import fs from "fs"
import path from "path"
import { errCodeAndMsg } from "./utility"
import logger from "../logger"
import { isDocker } from "../app"
import { checkPermissions } from "./permissions"

// Delete a file or directory from the filesystem of the machine
export const deleteFromMachine = (dirOrFilePath: string): boolean => {
  // If code is running in a Docker container, prepend /host_fs to the path.
  if (isDocker) {
    dirOrFilePath = path.join("/host_fs", dirOrFilePath)
  }

  try {
    // Check if the path exists
    if (!fs.existsSync(dirOrFilePath)) {
      logger.warn(`deleteFromMachine: File or directory not found: ${dirOrFilePath}`)
      return false
    }

    // Determine if the path is a directory or a file
    const stats = fs.lstatSync(dirOrFilePath)

    if (stats.isDirectory()) {
      // Use rmSync with recursive option to delete non-empty directories
      fs.rmSync(dirOrFilePath, { recursive: true, force: true })
      logger.info(`deleteFromMachine: Successfully deleted directory: ${dirOrFilePath}`)
    } else {
      // Otherwise, delete as a file
      fs.unlinkSync(dirOrFilePath)
      logger.info(`deleteFromMachine: Successfully deleted file: ${dirOrFilePath}`)
    }

    return true
  } catch (err) {
    logger.error(`deleteFromMachine: Error deleting file or directory: ${errCodeAndMsg(err)}`)
    return false
  }
}

type DeleteFailedReturn = {
  path: string
  deletions: number
  searched: number
  exists: boolean
  permissions: boolean
}[]

// Cache for permission checks to avoid redundant operations
const permissionCache: Record<string, boolean> = {}

// Throttling flag to prevent overlapping executions
let isExecuting = false

// Helper function to check and delete files or directories with '_FAILED_' substring
export const deleteFailedDownloads = async (paths: string[]): Promise<DeleteFailedReturn> => {
  const result: DeleteFailedReturn = []

  if (isExecuting) {
    logger.warn("deleteFailedDownloads is already running. Skipping...")
    return result
  }

  isExecuting = true

  try {
    if (process.env.NODE_ENV === "development") {
      logger.info("deleteFailedDownloads bypassed. In Development mode.")
      return result
    }

    for (const basePath of paths) {
      let deletions = 0 // Count of deletions for the current base path
      let searched = 0 // Count of items searched within the current base path
      let exists = false // Check if the path exists or not
      let permissions = false // Check if permissions are correct

      let fullPath = basePath

      // Prepend `/host_fs` if running in a Docker container
      if (isDocker) {
        fullPath = path.join("/host_fs", basePath)
      }

      // Check if the directory exists
      if (!fs.existsSync(fullPath)) {
        logger.info(`deleteFailedDownloads: Path does not exist: ${fullPath}`)
        result.push({ path: basePath, deletions, searched, exists, permissions })
        continue
      } else {
        exists = true
      }

      // Check and cache permissions
      const hasPermissions =
        permissionCache[basePath] ?? checkPermissions(basePath, ["read", "delete"])
      permissionCache[basePath] = hasPermissions
      if (!hasPermissions) {
        logger.info(`deleteFailedDownloads: Insufficient permissions for path: ${fullPath}`)
        result.push({ path: basePath, deletions, searched, exists, permissions })
        continue
      } else {
        permissions = true
      }

      try {
        // Get immediate children of the directory
        const children = await fs.promises.readdir(fullPath)
        searched = children.length // Count all children being searched

        // Process children
        const BATCH_SIZE = 100
        for (let i = 0; i < children.length; i += BATCH_SIZE) {
          const batch = children.slice(i, i + BATCH_SIZE)

          await Promise.all(
            batch.map(async (child) => {
              const childPath = path.join(fullPath, child)

              if (child.includes("_FAILED_")) {
                const stats = await fs.promises.stat(childPath)

                if (stats.isDirectory()) {
                  // Delete directory recursively
                  await fs.promises.rm(childPath, { recursive: true, force: true })
                  logger.info(`deleteFailedDownloads: Deleted directory: ${childPath}`)
                } else if (stats.isFile()) {
                  // Delete file
                  await fs.promises.unlink(childPath)
                  logger.info(`deleteFailedDownloads: Deleted file: ${childPath}`)
                }

                deletions++
              }
            }),
          )
        }
      } catch (err) {
        logger.error(
          `deleteFailedDownloads: Error processing path: ${basePath}. ${errCodeAndMsg(err)}`,
        )
      }

      // Add the results for this path
      result.push({ path: basePath, deletions, searched, exists, permissions })
    }
  } finally {
    isExecuting = false // Ensure the throttling flag is reset
  }

  return result
}
