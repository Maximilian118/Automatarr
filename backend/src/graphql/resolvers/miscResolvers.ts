import { loadBackupFile, readBackups } from "../../loops/backups"
import { AuthRequest } from "../../middleware/auth"
import Settings, { settingsDocType, settingsType } from "../../models/settings"
import { getChildPaths, getUnixGroups, getUnixUsers } from "../../shared/fileSystem"
import logger from "../../logger"
import { saveWithRetry } from "../../shared/database"

const miscResolvers = {
  checkUnixUsers: (_: any, req: AuthRequest): { data: string[]; tokens: string[] } => {
    if (!req.isAuth) {
      throw new Error("Unauthorised")
    }

    return {
      data: getUnixUsers(),
      tokens: req.tokens,
    }
  },
  checkUnixGroups: (_: any, req: AuthRequest): { data: string[]; tokens: string[] } => {
    if (!req.isAuth) {
      throw new Error("Unauthorised")
    }

    return {
      data: getUnixGroups(),
      tokens: req.tokens,
    }
  },
  getChildPaths: (
    { path }: { path?: string },
    req: AuthRequest,
  ): { data: string[]; tokens: string[] } => {
    if (!req.isAuth) {
      throw new Error("Unauthorised")
    }

    return {
      data: getChildPaths(path ? path : "/"),
      tokens: req.tokens,
    }
  },
  getBackupFiles: (_: any, req: AuthRequest): { data: string[]; tokens: string[] } => {
    if (!req.isAuth) {
      throw new Error("Unauthorised")
    }

    return {
      data: readBackups(),
      tokens: req.tokens,
    }
  },
  getBackupFile: async (
    { fileName }: { fileName: string },
    req: AuthRequest,
  ): Promise<settingsType> => {
    if (!req.isAuth) {
      throw new Error("Unauthorised")
    }

    const settings = (await Settings.findOne()) as settingsDocType

    if (!settings) {
      logger.error("getBackupFile: No Settings were found.")
      throw new Error("No Settings found")
    }

    const parsedSettingsBackup = loadBackupFile(fileName)

    // Overwrite fields on the actual Mongoose document
    Object.assign(settings, parsedSettingsBackup)

    // Save the updated document
    await saveWithRetry(settings, "getBackupFile")

    // Return the updated document with tokens
    return {
      ...settings._doc,
      tokens: req.tokens,
    }
  },
}

export default miscResolvers
