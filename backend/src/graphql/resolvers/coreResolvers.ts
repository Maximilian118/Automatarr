import logger from "../../logger"
import { settingsType } from "../../models/settings"
import Data, { downloadQueue } from "../../models/data"
import { commandData, DownloadStatus } from "../../types/types"
import { deleteFromQueue, getQueue, importCommand, searchMissing } from "../../shared/StarrRequests"
import { activeAPIsArr } from "../../shared/activeAPIsArr"
import { deleteFromMachine } from "../../shared/fileSystem"
import { checkPermissions } from "../../shared/permissions"

const coreResolvers = {
  search_wanted_missing: async (settings: settingsType): Promise<void> => {
    // Only get data for API's that have been checked and are active
    const activeAPIs = await activeAPIsArr(settings)
    // Loop through all of the active API's and send the relevant command request to search for wanted missing
    for (const API of activeAPIs) {
      // If this API is already searching, return
      if (API.data.commands) {
        const alreadySearching = (commands: commandData[]) =>
          commands.some((a) => a.name.toLowerCase().startsWith("missing"))

        if (alreadySearching(API.data.commands)) {
          logger.info(`wantedMissing: ${API.name} is already searching.`)
          continue
        }
      }

      // Send the command request
      await searchMissing(API)
    }
  },
  import_blocked_handler: async (settings: settingsType): Promise<void> => {
    // Only get data for API's that have been checked and are active
    const activeAPIs = await activeAPIsArr(settings)
    // Loop through all of the active API's
    for (const API of activeAPIs) {
      // Create a downloadQueue object and retrieve the latest queue data
      let queue = await getQueue(API)

      if (!queue) {
        logger.error(`importBlocked: ${API.name} download queue could not be retrieved.`)
        continue
      }

      // Find all of the items in the queue that have trackedDownloadState of importBlocked
      const importBlockedArr: DownloadStatus[] = queue.data.filter(
        (item) =>
          item.trackedDownloadState === "importBlocked" ||
          item.trackedDownloadState === "importFailed",
      )

      // If no blocked files, return.
      if (importBlockedArr.length === 0) {
        logger.info(`importBlocked: There are no blocked files in the ${API.name} Queue.`)
        continue
      }

      // Check for a certain reason/message for importBlocked/importFailed
      const msgCheck = (blockedFile: DownloadStatus, msg: string): boolean => {
        if (!blockedFile.status) {
          logger.error("msgCheck: No status object could be found.")
          return false
        }

        return blockedFile.statusMessages.some(
          (statusMsg) =>
            statusMsg?.title?.includes(msg) ||
            statusMsg?.messages?.some((message) => message?.includes(msg)),
        )
      }

      // Remove the removed queue item from the respective downloadQueue in db
      const removeFromQueue = (
        queue: downloadQueue,
        blockedFile: DownloadStatus,
      ): downloadQueue => {
        return {
          ...queue,
          data: queue.data.filter((q) => q.id !== blockedFile.id),
        }
      }

      // Loop through all of the files that have importBlocked and handle them depending on message
      for (const blockedFile of importBlockedArr) {
        const oneMessage = blockedFile.statusMessages.length < 2
        const currentFileOrDirPath = blockedFile.outputPath
        const radarrIDConflict = msgCheck(blockedFile, "release was matched to movie by ID")
        const sonarrIDConflict = msgCheck(blockedFile, "release was matched to series by ID")
        const anyIDConflict = radarrIDConflict || sonarrIDConflict
        const missing = msgCheck(blockedFile, "missing")
        const unsupported = msgCheck(blockedFile, "unsupported")
        // First of all, check if any files are missing or unsupported. If true, we don't want them regardless of anything else.
        if (missing || unsupported) {
          // Delete the item from the queue. If successful, attempt to delete from filesystem as well.
          // The request should delete the file from filesystem with removeFromClient=true but we've also added our own solution just in case.
          if (await deleteFromQueue(blockedFile, API)) {
            let deletedfromFS = false
            // If we have the current file path and we have permission to delete the file, delete it.
            if (currentFileOrDirPath && checkPermissions(currentFileOrDirPath, ["delete"])) {
              deletedfromFS = deleteFromMachine(currentFileOrDirPath)
            }
            // prettier-ignore
            logger.info(`${API.name}: ${blockedFile.title} ${unsupported ? "is unsupported" : "has missing files"} and has been deleted from the queue${deletedfromFS && " and filesystem"}.`)
            // Update the db with the removed queue item
            queue = removeFromQueue(queue, blockedFile)
          } // deleteFromQueue will log any failures
          continue
        }
        // If the problem is an ID conflict and that's the only problem, import.
        if (anyIDConflict) {
          if (!oneMessage) {
            // prettier-ignore
            logger.info(`${API.name}: ${blockedFile.title} has an ID conflict but also has other errors. Defering to ther cases...`,)
          } else {
            // Import the queue item
            await importCommand(blockedFile, API)
            // Update the db with the removed queue item
            queue = removeFromQueue(queue, blockedFile)
            continue
          }
        }
      }

      // Retrieve the data object from the db
      const data = await Data.findOne()

      if (!data) {
        logger.error("importBlocked: Could not find data object in db.")
        continue
      }

      // Find the matching API download queue and update it
      data.downloadQueues = data.downloadQueues.map((item) =>
        item.name === queue.name ? queue : item,
      )

      // If there is no matching API download queue, add it
      if (!data.downloadQueues.some((item) => item.name === queue.name)) {
        data.downloadQueues.push(queue)
      }

      // Save the latest download queue data to the db
      await data.save()
    }
  },
}

export default coreResolvers
