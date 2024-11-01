import fs from "fs"
import path from "path"
import { errCodeAndMsg } from "./utility"
import logger from "../logger"
import { isDocker } from "../app"

// Delete a file or directory from the filesystem of the machine
export const deleteFromMachine = (dirOrFilePath: string): boolean => {
  // If code is running in a Docker container, prepend /host_fs to the path.
  if (isDocker) {
    dirOrFilePath = path.join("/host_fs", dirOrFilePath)
  }

  try {
    // Check if the path exists
    if (!fs.existsSync(dirOrFilePath)) {
      console.warn(`deleteFromMachine: File or directory not found: ${dirOrFilePath}`)
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
    console.error(`deleteFromMachine: Error deleting file or directory: ${errCodeAndMsg(err)}`)
    return false
  }
}
