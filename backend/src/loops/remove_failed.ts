import { settingsType } from "../models/settings"
import logger from "../logger"
import Data from "../models/data"
import { currentPaths, qBittorrentDataExists } from "../shared/utility"
import { deleteFailedDownloads } from "../shared/fileSystem"

const remove_failed = async (settings: settingsType): Promise<void> => {
  if (!settings.qBittorrent_active) {
    logger.error("Remove Failed: qBittorrent is required for this loop.")
    return
  }

  // Retrieve the data object from the db
  const data = await Data.findOne()

  if (!data) {
    logger.error("removeFailed: Could not find data object in db.")
    return
  }

  // If there's no qBittorrent data to check, return
  if (!qBittorrentDataExists(data)) {
    logger.warn("removeFailed: qBittorrent data required.")
    return
  }

  // Get all download paths and delete files with a substring of "_FAILED_"
  const stats = await deleteFailedDownloads(currentPaths(data))

  // Stats for logging
  const searched = stats.reduce((sum, { searched }) => sum + searched, 0)
  const deletions = stats.reduce((sum, { deletions }) => sum + deletions, 0)

  if (stats.length !== 0) {
    logger.success(
      `removeFailed: Removed ${deletions} failed downloads out of ${searched} downloads from ${stats.length} directories.`,
    )
  }
}

export default remove_failed
