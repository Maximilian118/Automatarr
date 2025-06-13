import { settingsType } from "../models/settings"
import { activeAPIsArr } from "../shared/activeAPIsArr"
import { deleteFromQueue, getQueue } from "../shared/StarrRequests"
import { capsFirstLetter, getContentName, updateDownloadQueue } from "../shared/utility"
import logger from "../logger"
import { DownloadStatus } from "../types/types"
import { saveWithRetry } from "../shared/database"
import { blocklistAndSearchMovie } from "../shared/RadarrStarrRequests"
import { blocklistAndSearchEpisode } from "../shared/SonarrStarrRequests"

const remove_blocked = async (settings: settingsType): Promise<void> => {
  // Only get data for API's that have been checked and are active
  const { data, activeAPIs } = await activeAPIsArr(settings)

  // Loop through all of the active API's
  for (const API of activeAPIs) {
    // Create a downloadQueue object and retrieve the latest queue data
    let queue = await getQueue(API, data)
    console.log(queue)
    if (!queue) {
      updateDownloadQueue(API, data)
      logger.error(`importBlocked: ${API.name} download queue could not be retrieved.`)
      continue
    }

    // Find all of the items in the queue that have trackedDownloadState of importBlocked
    const importBlockedArr: DownloadStatus[] = queue.data.filter(
      (item) =>
        item.trackedDownloadState === "importBlocked" ||
        item.trackedDownloadState === "importFailed" ||
        item.trackedDownloadState === "importPending",
    )

    // If no blocked files, return.
    if (importBlockedArr.length === 0) {
      updateDownloadQueue(API, data, queue)
      logger.info(`importBlocked: There are no blocked files in the ${API.name} Queue.`)
      continue
    }

    // Check for a certain reason/message for importBlocked/importFailed
    const msgCheck = (blockedFile: DownloadStatus, msgArr: string[]): string => {
      if (!blockedFile.status) {
        logger.error("msgCheck: No status object could be found.")
        return ""
      }

      for (const msg of msgArr) {
        const lowerMsg = msg.toLowerCase()

        const hasMatch = blockedFile.statusMessages.some(
          (statusMsg) =>
            statusMsg?.title?.toLowerCase().includes(lowerMsg) ||
            statusMsg?.messages?.some((message) => message?.toLowerCase().includes(lowerMsg)),
        )

        if (hasMatch) return `${capsFirstLetter(msg)}.`
      }

      return ""
    }

    // Create a deduplication key using downloadId, fallback to title or ID
    const getDedupKey = (blockedFile: DownloadStatus): string => {
      return (
        blockedFile.downloadId?.toLowerCase().trim() ??
        blockedFile.title?.toLowerCase().trim() ??
        `missing-${blockedFile.id}`
      )
    }

    // Create a reference for all files that have been deleted to avoid attempting to delete the same file twice.
    // Useful for Sonarr, where multiple episodes may match the same season download.
    const deletedKeys = new Set<string>()

    // Loop through all of the files that have importBlocked and handle them depending on message
    for (const blockedFile of importBlockedArr) {
      const dedupKey = getDedupKey(blockedFile)
      if (deletedKeys.has(dedupKey)) continue

      const oneMessage = blockedFile.statusMessages.length < 2
      const deleteCase = msgCheck(blockedFile, [
        "missing",
        "unsupported",
        "not a custom format upgrade",
        "title mismatch",
        "sample",
        "might need to be extracted",
      ])
      const idConflict = msgCheck(blockedFile, [`matched to ${getContentName(API)} by ID`])

      // Attempt to delete and record the deduplication key
      const tryDelete = async (reason: string) => {
        const deleted = await deleteFromQueue(blockedFile, API, reason)

        if (deleted) {
          deletedKeys.add(dedupKey)
          // Add the deleted queue item to the blocklist
          if (API.name === "Radarr") {
            await blocklistAndSearchMovie(settings, deleted.movieId)
          } else if (API.name === "Sonarr") {
            await blocklistAndSearchEpisode(settings, deleted.episodeId)
          }
          // Update the db with the removed queue item
          updateDownloadQueue(API, data, queue, blockedFile)
        }
      }

      // If the problem is an ID conflict and that's the only problem, delete.
      if (idConflict) {
        if (!oneMessage) {
          logger.warn(
            `${API.name} | ${blockedFile.title}. ID conflict but has other errors. Deferring to other cases...`,
          )
        } else {
          await tryDelete("ID Conflict.")
        }

        continue
      }

      // If the msg is a case where we just want to delete the download, delete it.
      if (deleteCase) {
        await tryDelete(deleteCase)
        continue
      }

      // Catch-all: log anything that made it through without matching any expected reason
      const statusMsgs = blockedFile.statusMessages
        .flatMap((s) => [s.title, ...(s.messages ?? [])])
        .filter(Boolean)
        .join("; ")
      console.log(blockedFile.statusMessages[0])
      logger.warn(
        `${API.name} | ${blockedFile.title} has a blocked status of "${statusMsgs}" that was not handled.`,
      )
    }
  }

  // Save the latest download queue data to the db
  await saveWithRetry(data, "remove_blocked")
}

export default remove_blocked
