import fs from "fs"
import path from "path"
import { isPosix, isThreeDigitOctal } from "./utility"
import logger from "../logger"
import { isDocker } from "../app"
import { checkPermissions } from "./permissions"
import { execSync } from "child_process"
import { errCodeAndMsg } from "./requestError"

// Delete a file or directory from the filesystem of the machine
export const deleteFromMachine = (dirOrFilePath: string): boolean => {
  if (process.env.NODE_ENV === "development") {
    logger.info("deleteFromMachine bypassed. In Development mode... risky stuff!")
    return false
  }

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
      logger.info("removeFailed bypassed. In Development mode.")
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
        logger.error(`deleteFailedDownloads: Path does not exist: ${fullPath}`)
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
        logger.error(`deleteFailedDownloads: Insufficient permissions for path: ${fullPath}`)
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

// Preload mappings of UID -> username and GID -> group name
const loadUserAndGroupMappings = () => {
  const passwdPath = isDocker ? "/host_fs/etc/passwd" : "/etc/passwd"
  const groupPath = isDocker ? "/host_fs/etc/group" : "/etc/group"

  const uidToUser: Record<number, string> = {}
  const gidToGroup: Record<number, string> = {}

  try {
    const passwdFile = fs.readFileSync(passwdPath, "utf8")
    passwdFile.split("\n").forEach((line) => {
      const fields = line.split(":")
      if (fields.length >= 3) {
        const uid = parseInt(fields[2], 10)
        uidToUser[uid] = fields[0] // Username
      }
    })
  } catch (err) {
    logger.error(`Error loading /etc/passwd: ${err}`)
  }

  try {
    const groupFile = fs.readFileSync(groupPath, "utf8")
    groupFile.split("\n").forEach((line) => {
      const fields = line.split(":")
      if (fields.length >= 3) {
        const gid = parseInt(fields[2], 10)
        gidToGroup[gid] = fields[0] // Group name
      }
    })
  } catch (err) {
    logger.error(`Error loading /etc/group: ${err}`)
  }

  return { uidToUser, gidToGroup }
}

// Take the name of a user and return its UID number
const getUserUID = (user: string): number | undefined => {
  try {
    const passwdPath = `${isDocker ? "/host_fs" : ""}/etc/passwd`
    const passwdFile = fs.readFileSync(passwdPath, "utf8")
    const line = passwdFile.split("\n").find((line) => line.startsWith(`${user}:`))
    if (line) {
      const uid = line.split(":")[2]
      return parseInt(uid, 10)
    }
  } catch (err) {
    console.error(`User '${user}' not found`)
  }

  return
}

// Take the name of a group and return its GID number
const getGroupGID = (group: string): number | undefined => {
  try {
    const groupPath = `${isDocker ? "/host_fs" : ""}/etc/group`
    const groupFile = fs.readFileSync(groupPath, "utf8")
    const line = groupFile.split("\n").find((line) => line.startsWith(`${group}:`))
    if (line) {
      const gid = line.split(":")[2]
      return parseInt(gid, 10)
    }
  } catch (err) {
    console.error(`Group '${group}' not found`)
  }

  return
}

interface updatePathsResult {
  path: string // The path in question
  exists: boolean // Does the path exist?
  libraryTotal: number // The total amount of children of the path
  foundUIDs: Record<string, number> // A colleciton of all the users found
  foundGIDs: Record<string, number> // A colleciton of all the groups found
  searched: number // The total amount of everything searched
  updated: number //  The total amount of children that have been updated
}

// Throttling flag to prevent overlapping executions
let updatePathsExecuting = false

// Update chown or chmod of everything in paths
export const updatePaths = async (
  paths: string[],
  chown?: string,
  chmod?: string,
  verbose?: boolean,
): Promise<updatePathsResult[]> => {
  if (process.env.NODE_ENV === "development") {
    logger.info("updatePaths cancelled. In Development mode.")
    return []
  }

  if (updatePathsExecuting) {
    logger.warn("updatePaths: Operation is already executing. Skipping this run.")
    return []
  }

  updatePathsExecuting = true

  if (!chown && !chmod) {
    logger.error("updatePaths: No chown or chmod information provided. Aborting operation.")
    return []
  }

  let user = ""
  let group = ""

  if (chown) {
    const userAndGroup = chown.replace(/\s+/g, "").split(":")

    if (userAndGroup.length !== 2) {
      logger.error(`permissionsChange: Unexpected length: ${userAndGroup.length}`)
      return []
    }

    if (!userAndGroup[0]) {
      logger.error(`permissionsChange: Unexpected User value: ${userAndGroup[0]}`)
      return []
    }

    if (!isPosix(userAndGroup[0])) {
      logger.error(`permissionsChange: User must meet POSIX standard: ${userAndGroup[0]}`)
      return []
    }

    if (!userAndGroup[1]) {
      logger.error(`permissionsChange: Unexpected Group value: ${userAndGroup[1]}`)
      return []
    }

    if (!isPosix(userAndGroup[1])) {
      logger.error(`permissionsChange: Group must meet POSIX standard: ${userAndGroup[1]}`)
      return []
    }

    user = userAndGroup[0]
    group = userAndGroup[1]
  }

  const results: updatePathsResult[] = []

  try {
    for (let dirPath of paths) {
      // Init the result object for this path
      let res: updatePathsResult = {
        path: dirPath,
        exists: false,
        libraryTotal: 0,
        foundUIDs: {},
        foundGIDs: {},
        searched: 0,
        updated: 0,
      }

      // Prepend `/host_fs` if running in a Docker container
      if (isDocker) {
        dirPath = path.join("/host_fs", dirPath)
      }

      // Check that the path at least exists
      if (!fs.existsSync(dirPath)) {
        logger.error(`updatePaths: Path does not exist! ${dirPath}`)
        results.push(res)
        continue
      }

      res.exists = true

      // Get all children of the specified directory
      const children = fs.readdirSync(dirPath)
      res.libraryTotal = children.length

      const updateChildPermissions = (childPath: string): void => {
        try {
          res.searched++ // Another file or dir searched
          const stats = fs.lstatSync(childPath) // Get current file stats
          const { uidToUser, gidToGroup } = loadUserAndGroupMappings()
          const u = uidToUser[stats.uid] || stats.uid // Fallback to UID if not found
          const g = gidToGroup[stats.gid] || stats.gid // Fallback to GID if not found

          // Update foundUIDs with ++ for this user
          res.foundUIDs[u] = (res.foundUIDs[u] || 0) + 1

          // Update foundGIDs with ++ for this group
          res.foundGIDs[g] = (res.foundGIDs[g] || 0) + 1

          // Flag to ensure only count one update per item
          let update = false

          // Check and update ownership
          if (chown) {
            const currentUID = stats.uid
            const currentGID = stats.gid
            const desiredUID = getUserUID(user)
            const desiredGID = getGroupGID(group)

            if (!desiredUID) {
              logger.error(`permissionsChange: UID could not be found for ${user}`)
              return
            }

            if (!desiredGID) {
              logger.error(`permissionsChange: GID could not be found for ${group}`)
              return
            }

            if (currentUID !== desiredUID || currentGID !== desiredGID) {
              fs.chownSync(childPath, desiredUID, desiredGID)
              verbose &&
                logger.info(`permissionsChange: ${childPath} updated chown to ${user}:${group}`)
              update = true
            }
          }

          // Check and update permissions
          if (chmod) {
            if (!isThreeDigitOctal(chmod)) {
              logger.error(`permissionsChange: Must be a string of three numbers: ${chmod}`)
            } else {
              if ((stats.mode & 0o777).toString(8) !== chmod) {
                fs.chmodSync(childPath, parseInt(chmod, 8))
                verbose && logger.info(`permissionsChange: ${childPath} updated chmod to ${chmod}`)
                update = true
              }
            }
          }

          // Only increment res.updated once per item
          if (update) {
            res.updated++
          }

          // Recurse into directories
          if (stats.isDirectory()) {
            const children = fs.readdirSync(childPath)

            for (const grandchild of children) {
              updateChildPermissions(path.join(childPath, grandchild))
            }
          }
        } catch (err) {
          logger.error(`updatePaths: Error processing ${childPath}: ${err}`)
        }
      }

      // Loop through each paths children
      for (const child of children) {
        updateChildPermissions(path.join(dirPath, child))
      }

      results.push(res)
    }

    return results
  } catch (err) {
    logger.error(`updatePaths: Error: ${err}`)
    return []
  } finally {
    updatePathsExecuting = false
  }
}

// Return users from a Unix OS
export const getUnixUsers = (): string[] => {
  const unixUsers: Set<string> = new Set()
  let passwdFilePath = "/etc/passwd"

  // Prepend `/host_fs` if running in a Docker container
  if (isDocker) {
    passwdFilePath = path.join("/host_fs", passwdFilePath)
  }

  // Check that /etc/passwd exists
  if (fs.existsSync(passwdFilePath)) {
    const passwdFile = fs.readFileSync(passwdFilePath, "utf8")
    const lines = passwdFile.split("\n")

    for (const line of lines) {
      if (line.trim() === "") {
        continue
      }

      const parts = line.split(":")
      const username = parts[0]
      const uid = parseInt(parts[2], 10) // UID is the third field in /etc/passwd

      // Skip system accounts with UID below the threshold
      if (uid === 0 || uid >= 100) {
        unixUsers.add(username)
      }
    }
  }

  // Add macOS users using dscl command
  try {
    if (process.platform === "darwin") {
      const dsclUsers = execSync("dscl . list /Users").toString().split("\n")
      for (const username of dsclUsers) {
        if (username.trim()) {
          unixUsers.add(username.trim())
        }
      }
    }
  } catch (err) {
    // Silently ignore errors if we're not using macOS
  }

  // Return a unique, filtered list of users
  return Array.from(unixUsers).filter((u) => !u.startsWith("_") && !u.startsWith("#"))
}

// Return groups from a Unix OS
export const getUnixGroups = (): string[] => {
  const unixGroups: Set<string> = new Set()
  let groupFilePath = "/etc/group"

  // Prepend `/host_fs` if running in a Docker container
  if (isDocker) {
    groupFilePath = path.join("/host_fs", groupFilePath)
  }

  // Check that /etc/group exists
  if (fs.existsSync(groupFilePath)) {
    const groupFile = fs.readFileSync(groupFilePath, "utf8")
    const lines = groupFile.split("\n")

    // Loop through each line in the file
    for (const line of lines) {
      if (line.trim() === "") {
        continue
      }

      const parts = line.split(":")
      const group = parts[0]
      const gid = parseInt(parts[2], 10) // GID is the 3rd field in /etc/group

      // Skip system groups with GID below the threshold
      if (gid === 0 || gid >= 100) {
        unixGroups.add(group)
      }
    }
  }

  // Add macOS groups using dscl command
  try {
    if (process.platform === "darwin") {
      const dsclGroups = execSync("dscl . list /Groups").toString().split("\n")
      for (const group of dsclGroups) {
        if (group.trim()) {
          unixGroups.add(group.trim())
        }
      }
    }
  } catch (err) {
    // Silently ignore errors if we're not using macOS
  }

  // Return a unique, filtered list of groups
  return Array.from(unixGroups).filter((g) => !g.startsWith("_") && !g.startsWith("#"))
}

// Return an array of paths for every child directory
export const getChildPaths = (parentPath: string): string[] => {
  let actualPath = parentPath

  // Prepend `/host_fs` if running in a Docker container
  if (isDocker) {
    actualPath = path.join("/host_fs", parentPath)
  }

  try {
    // Read the contents of the parent directory
    const childNames = fs.readdirSync(actualPath, { withFileTypes: true })

    // Filter only directories and resolve their full paths
    return childNames
      .filter((dir) => dir.isDirectory()) // Only directories
      .map((dir) => path.join(parentPath, dir.name)) // Map to full path without /host_fs
  } catch (err) {
    logger.error(`getChildPaths: Error reading directory ${actualPath}:`, err)
    return []
  }
}
