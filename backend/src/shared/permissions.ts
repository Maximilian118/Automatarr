import fs from "fs"
import path from "path"
import { errCodeAndMsg } from "./utility"
import { dataType } from "../models/data"
import logger from "../logger"

type permissionTypes = "read" | "write" | "delete" | "move" | "all"
// Check that Automatarr has the correct permissions for a passed directory path or file path.
// Permissions to be checked are specified in an array of strings as the 2nd param.
export const checkPermissions = (dirOrFilePath: string, perms?: permissionTypes[]): boolean => {
  const isDirectory = fs.existsSync(dirOrFilePath) && fs.lstatSync(dirOrFilePath).isDirectory()
  const testFilePath = isDirectory ? path.join(dirOrFilePath, "temp_test_file.tmp") : dirOrFilePath
  const movedTestFilePath = isDirectory
    ? path.join(dirOrFilePath, "temp_test_file_moved.tmp")
    : `${dirOrFilePath}_moved.tmp`

  // If "all" is in the array, replace perms with all permissions to check.
  if (!perms || perms.includes("all")) {
    perms = ["read", "write", "delete", "move"]
  }

  try {
    for (const perm of perms) {
      switch (perm) {
        case "read":
          if (!fs.existsSync(dirOrFilePath)) {
            logger.error(`Path does not exist: ${dirOrFilePath}`)
            return false
          }

          if (isDirectory && !fs.readdirSync(dirOrFilePath)) {
            logger.error(`Read permission denied: ${dirOrFilePath}`)
            return false
          }

          if (!isDirectory && !fs.readFileSync(dirOrFilePath)) {
            logger.error(`Read permission denied: ${dirOrFilePath}`)
            return false
          }
          break

        case "write":
          fs.writeFileSync(testFilePath, "test")
          if (isDirectory) fs.unlinkSync(testFilePath) // Clean up for directory test
          break

        case "delete":
          fs.writeFileSync(testFilePath, "test")
          fs.unlinkSync(testFilePath) // Attempt to delete the test file
          break

        case "move":
          fs.writeFileSync(testFilePath, "test")
          fs.renameSync(testFilePath, movedTestFilePath) // Attempt to rename/move the file
          fs.unlinkSync(movedTestFilePath) // Clean up after test
          break

        default:
          logger.error(`Invalid permission type specified: ${perm}`)
      }
    }

    logger.info(`Permissions: ${dirOrFilePath} Checked and passed ${perms}`)
    return true
  } catch (err) {
    console.error(
      `Permission check for [${perms.join(
        ", ",
      )}] failed at path: ${dirOrFilePath}. Error: ${errCodeAndMsg(err)}`,
    )
    return false
  }
}

// Check all needed directories on boot
export const bootPermissions = (data: dataType | undefined): void => {
  if (!data) {
    logger.error(`Permissions: No Root File Data.`)
    return
  }

  for (const rootFolder of data.rootFolders) {
    checkPermissions(rootFolder.data.path)
  }
}
