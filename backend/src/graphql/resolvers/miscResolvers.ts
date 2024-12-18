import { getChildPaths, getUnixGroups, getUnixUsers } from "../../shared/fileSystem"

const miscResolvers = {
  checkUsers: (): string[] => getUnixUsers(),
  checkGroups: (): string[] => getUnixGroups(),
  getChildPaths: ({ path }: { path?: string }): string[] => getChildPaths(path ? path : "/"),
}

export default miscResolvers
