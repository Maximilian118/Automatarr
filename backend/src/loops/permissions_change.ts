import { settingsType } from "../models/settings"
import logger from "../logger"
import Data from "../models/data"
import { updatePaths } from "../shared/fileSystem"

const permissions_change = async (settings: settingsType): Promise<void> => {
  // Retrieve the data object from the db
  const data = await Data.findOne()

  if (!data) {
    logger.error("permissionsChange: Could not find data object in db.")
    return
  }

  if (!data.rootFolders) {
    logger.error("permissionsChange: No Starr App root folders found.")
    return
  }

  const paths = data.rootFolders.map((p) => p.data.path)

  if (!paths || paths.length === 0) {
    logger.error("permissionsChange: No root paths.")
    return
  }

  const stats = await updatePaths(
    paths,
    settings.permissions_change_chown,
    settings.permissions_change_chmod,
  )

  if (stats.length === 0) {
    logger.warn("permissionsChange: No stats... how curious...")
    return
  }

  const updated = stats.map((s) => s.updated).reduce((acc, curr) => acc + curr, 0)
  const searched = stats.map((s) => s.searched).reduce((acc, curr) => acc + curr, 0)

  logger.success(
    `permissionsChange: Updated ${updated} items of ${searched} searched from ${stats.length} directories.`,
  )
}

export default permissions_change
