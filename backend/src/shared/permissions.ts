import fs from "fs"
import path from "path"
import { errCodeAndMsg, capsFirstLetter } from "./utility"
import { dataType } from "../models/data"
import logger from "../logger"
import { isDocker } from "../app"

type permissionTypes = "read" | "write" | "delete" | "move" | "all"

// Prefix for accessing the host filesystem
const hostFS = "/host_fs"

// Function to verify host filesystem availability
const isHostFsAvailable = (isDocker?: boolean): boolean => {
  if (isDocker && !fs.existsSync(hostFS)) {
    logger.warn("Host filesystem not mounted.")
    return false
  }

  return true
}

// Check that Automatarr has the correct permissions for a given directory path or file path.
// Permissions to be checked are specified in an array of strings as the second parameter.
export const checkPermissions = (
  dirOrFilePath: string,
  perms?: permissionTypes[],
  APIName?: string,
): boolean => {
  if (process.env.NODE_ENV === "development") {
    logger.info("Permissions Check bypassed. In Development mode.")
    return true
  }

  // If no host file system, there there's no data to check with so just return
  if (!isHostFsAvailable(isDocker)) {
    return false
  }

  // Save the original passed path for logging
  const originalPath = dirOrFilePath

  // If code is running in a Docker container, Prepend /host_fs to the path.
  if (isDocker) {
    dirOrFilePath = path.join(hostFS, dirOrFilePath)
  }

  // Check if the specified path exists and if it is a directory.
  const isDirectory = fs.existsSync(dirOrFilePath) && fs.lstatSync(dirOrFilePath).isDirectory()

  // Define a temporary test file path. If the path is a directory, create the temp file inside it; otherwise, use the provided file path.
  const testFilePath = isDirectory ? path.join(dirOrFilePath, "temp_test_file.tmp") : dirOrFilePath

  // Define a path for a temporary moved test file. If the path is a directory, create the moved temp file inside it; otherwise, append '_moved' to the provided file path.
  const movedTestFilePath = isDirectory
    ? path.join(dirOrFilePath, "temp_test_file_moved.tmp") // If it's a directory, place the moved file in the same directory.
    : `${dirOrFilePath}_moved.tmp` // If it's a file, create the moved file with a modified name.

  // If "all" is in the array, replace perms with all permissions to check.
  if (!perms || perms.includes("all")) {
    perms = ["read", "write", "delete", "move"]
  }

  // Neaten passed perms for logging
  const neatPerms = `[${perms.map((perm: string) => `${capsFirstLetter(perm)}`).join(", ")}]`

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

    if (APIName) {
      logger.info(`${APIName} | Permissions: ${neatPerms} ${originalPath} OK!`)
    }

    return true
  } catch (err) {
    logger.error(`
      ${APIName ? `${APIName} |` : ""} Permissions: ${neatPerms} check failed for ${originalPath}. 
      Error: ${errCodeAndMsg(err)}`)
    return false
  }
}

// Check all needed directories on boot
export const bootPermissions = (data: dataType | undefined): void => {
  if (!isHostFsAvailable(isDocker)) {
    logger.warn(`bootPermissions: Cannot find host file system.`)
    return
  }

  if (!data) {
    logger.error(`bootPermissions: No data.`)
    return
  }

  for (const rootFolder of data.rootFolders) {
    checkPermissions(rootFolder.data.path, ["all"], rootFolder.name)
  }
}
