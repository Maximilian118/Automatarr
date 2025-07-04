import { readBackups } from "../../loops/backups"
import { AuthRequest } from "../../middleware/auth"
import { getChildPaths, getUnixGroups, getUnixUsers } from "../../shared/fileSystem"

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
}

export default miscResolvers
