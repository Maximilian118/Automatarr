import logger from "../../logger"
import { settingsType } from "../../models/settings"
import Data from "../../models/data"
import { commandData, DownloadStatus } from "../../types/types"
import {
  deleteFromLibrary,
  deleteFromQueue,
  getQueue,
  importCommand,
  searchMissing,
} from "../../shared/StarrRequests"
import { activeAPIsArr } from "../../shared/activeAPIsArr"
import {
  deleteFailedDownloads,
  deleteFromMachine,
  getChildPaths,
  updatePaths,
} from "../../shared/fileSystem"
import { checkPermissions } from "../../shared/permissions"
import { currentPaths, qBittorrentDataExists, updateDownloadQueue } from "../../shared/utility"
import { getMdbListItems } from "../../shared/mdbListRequests"
import { Movie } from "../../types/movieTypes"
import { Series } from "../../types/seriesTypes"
import moment from "moment"

const coreResolvers = {
  search_wanted_missing: async (settings: settingsType): Promise<void> => {
    // Only get data for API's that have been checked and are active
    const { activeAPIs } = await activeAPIsArr(settings)
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
    const { data, activeAPIs } = await activeAPIsArr(settings)

    // Loop through all of the active API's
    for (const API of activeAPIs) {
      // Create a downloadQueue object and retrieve the latest queue data
      let queue = await getQueue(API, data)

      if (!queue) {
        updateDownloadQueue(API, data)
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
        updateDownloadQueue(API, data, queue)
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
            updateDownloadQueue(API, data, queue, blockedFile)
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
            updateDownloadQueue(API, data, queue, blockedFile)
            continue
          }
        }
      }
    }

    // Save the latest download queue data to the db
    await data.save()
  },
  remove_failed: async (): Promise<void> => {
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
      logger.info(
        `removeFailed: Removed ${deletions} failed downloads out of ${searched} downloads from ${stats.length} directories.`,
      )
    }
  },
  permissions_change: async (settings: settingsType): Promise<void> => {
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

    logger.info(
      `permissionsChange: Updated ${updated} items of ${searched} searched from ${stats.length} directories.`,
    )
  },
  remove_missing: async (settings: settingsType): Promise<void> => {
    // Only get data for API's that have been checked and are active
    const { data, activeAPIs } = await activeAPIsArr(settings)

    // Loop through each active API
    for (const API of activeAPIs) {
      // Skip Lidarr... might add later
      if (API.name === "Lidarr") {
        continue
      }

      // Skip if this API has no import lists
      if (!API.data.importLists || API.data.importLists.length === 0) {
        logger.warn(`removeMissing: ${API.name} has no Import Lists.`)
        continue
      }

      const library = API.data.library as (Movie | Series)[]

      // Ensure library for this API exists
      if (!library) {
        logger.error(`removeMissing: No library data for ${API.name}.`)
        continue
      }

      // Count the amount of deleted items
      let deletedCount = 0

      // Remove anything that's not in Import Lists
      if (settings.remove_missing_level === "Import List") {
        // An array of items from import lists from various list APIs such as mdbList
        const importListItems = await getMdbListItems(API)

        // Create a Set of all identifiers for quick lookups
        const tmdbSet = new Set(importListItems.map((item) => item.id))
        const imdbSet = new Set(importListItems.map((item) => item.imdb_id))
        const tvdbSet = new Set(importListItems.map((item) => item.tvdbid).filter(Boolean)) // Exclude null/undefined

        // Filter the library for items not in the import list
        for (const libraryItem of library) {
          const matchesTmdb = tmdbSet.has(libraryItem.tmdbId)
          const matchesImdb = imdbSet.has(libraryItem.imdbId)
          const matchesTvdb = "tvdbId" in libraryItem && tvdbSet.has(libraryItem.tvdbId)

          // If no match is found, delete from library and file system
          if (!matchesTmdb && !matchesImdb && !matchesTvdb) {
            // Request also deletes through Starr API
            await deleteFromLibrary(libraryItem, API)
            // Update Library with the removed library items.
            data.libraries = data.libraries.map((lib) => {
              if (lib.name === API.name) {
                return {
                  ...lib,
                  data: lib.data.filter((l) => l.id !== libraryItem.id),
                  updated_at: moment().format(),
                }
              }
              return lib // Return other libraries unchanged
            })

            deletedCount++
          }
        }

        if (deletedCount > 0) {
          data.updated_at = moment().format()
          await data.save()
        }
      }

      // If we're just checking if there's anything in the file system that isn't in the library
      if (settings.remove_missing_level === "Library") {
        // Check we have root folder path
        if (!API.data.rootFolder) {
          logger.error(`removeMissing: Root folder data missing for ${API.name}.`)
          continue
        }

        // Retrieve an array of paths for the root folder
        const rootChildrenPaths = getChildPaths(API.data.rootFolder.path)

        // Create a Set of paths for all currnet library items
        const libraryPaths = new Set(library.map((item) => item.path))

        // Loop through all of the paths
        for (const childPath of rootChildrenPaths) {
          // If the directory in host file system is not present in library
          if (!libraryPaths.has(childPath)) {
            // Delete the directory recursively from the file system
            deleteFromMachine(childPath)
            deletedCount++
          }
        }
      }

      logger.info(
        `removeMissing: Level: ${settings.remove_missing_level}. ${API.name}: Deleted ${deletedCount} items of ${library.length}.`,
      )
    }
  },
}

export default coreResolvers
