import logger from "../../logger"
import { settingsType } from "../../models/settings"
import Data from "../../models/data"
import { commandData, DownloadStatus } from "../../types/types"
import {
  deleteFromLibrary,
  deleteFromQueue,
  getQueue,
  searchMissing,
} from "../../shared/StarrRequests"
import { activeAPIsArr } from "../../shared/activeAPIsArr"
import {
  deleteFailedDownloads,
  deleteFromMachine,
  getChildPaths,
  updatePaths,
} from "../../shared/fileSystem"
import {
  currentPaths,
  getContentName,
  processingTimeMessage,
  qBittorrentDataExists,
  updateDownloadQueue,
} from "../../shared/utility"
import { getMdbListItems } from "../../shared/mdbListRequests"
import { Movie } from "../../types/movieTypes"
import { Series } from "../../types/seriesTypes"
import moment from "moment"
import { counter, counterTracking } from "../../shared/counter"
import { deleteqBittorrent, getqBittorrentTorrents } from "../../shared/qBittorrentRequests"
import { saveWithRetry } from "../../shared/database"
import {
  findLibraryTorrents,
  torrentDownloadedCheck,
  torrentSeedCheck,
} from "../../shared/qBittorrentUtility"
import { isMovie } from "../../types/typeGuards"

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
      // prettier-ignore
      await searchMissing(API.data.commandList, API.name, API.data.URL, API.data.API_version, API.data.KEY)
    }
  },
  remove_blocked: async (settings: settingsType): Promise<void> => {
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
      const msgCheck = (blockedFile: DownloadStatus, msg: string): boolean => {
        if (!blockedFile.status) {
          logger.error("msgCheck: No status object could be found.")
          return false
        }

        const lowerMsg = msg.toLowerCase()

        return blockedFile.statusMessages.some(
          (statusMsg) =>
            statusMsg?.title?.toLowerCase().includes(lowerMsg) ||
            statusMsg?.messages?.some((message) => message?.toLowerCase().includes(lowerMsg)),
        )
      }

      // Check if a download has already been deleted
      const alreadyDeleted = (blockedFile: DownloadStatus, deletedTitles: Set<string>): boolean => {
        const titleKey = blockedFile.title?.toLowerCase().trim()
        return !titleKey || deletedTitles.has(titleKey)
      }

      // Create a reference for all files that have been deleted to avoid attempting to delete the same file twice.
      // Useful for Sonarr, where multiple episodes may match the same season download.
      const deletedTitles = new Set<string>()

      // Loop through all of the files that have importBlocked and handle them depending on message
      for (const blockedFile of importBlockedArr) {
        const oneMessage = blockedFile.statusMessages.length < 2
        const idConflict = msgCheck(blockedFile, `matched to ${getContentName(API)} by ID`)
        const missing = msgCheck(blockedFile, "missing")
        const unsupported = msgCheck(blockedFile, "unsupported")
        const titleMissmatch = msgCheck(blockedFile, "title mismatch")
        const notAnUpgrade = msgCheck(blockedFile, "not a custom format upgrade")

        // First of all, check if any files are missing or unsupported. If true, we don't want them regardless of anything else.
        if (missing || unsupported) {
          // If the download has already been deleted, silently continue
          if (alreadyDeleted(blockedFile, deletedTitles)) continue
          // Delete the item from the queue.
          const deleted = await deleteFromQueue(
            blockedFile,
            API,
            `${unsupported ? "Unsupported." : "Missing files."}`,
          )

          if (deleted) {
            deletedTitles.add(deleted.title)
            // Update the db with the removed queue item
            updateDownloadQueue(API, data, queue, blockedFile)
          }

          continue
        }

        // If the problem is an ID conflict and that's the only problem, delete.
        if (idConflict) {
          if (alreadyDeleted(blockedFile, deletedTitles)) continue

          if (!oneMessage) {
            logger.warn(
              `${API.name}: ${blockedFile.title} has an ID conflict but also has other errors. Defering to ther cases...`,
            )
          } else {
            const deleted = await deleteFromQueue(blockedFile, API, "ID conflict.")

            if (deleted) {
              deletedTitles.add(deleted.title)
              updateDownloadQueue(API, data, queue, blockedFile)
            }

            continue
          }
        }

        if (notAnUpgrade || titleMissmatch) {
          if (alreadyDeleted(blockedFile, deletedTitles)) continue
          const deleted = await deleteFromQueue(
            blockedFile,
            API,
            titleMissmatch ? "Title mismatch." : "Not an upgrade.",
          )

          if (deleted) {
            deletedTitles.add(deleted.title)
            updateDownloadQueue(API, data, queue, blockedFile)
          }

          continue
        }
      }
    }

    // Save the latest download queue data to the db
    await saveWithRetry(data, "remove_blocked")
  },
  remove_failed: async (settings: settingsType): Promise<void> => {
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

    logger.success(
      `permissionsChange: Updated ${updated} items of ${searched} searched from ${stats.length} directories.`,
    )
  },
  remove_missing: async (settings: settingsType): Promise<void> => {
    if (!settings.qBittorrent_active) {
      logger.error("Remove Missing: qBittorrent is required for this loop.")
      return
    }

    // Only get data for API's that have been checked and are active
    const { data, activeAPIs } = await activeAPIsArr(settings)

    // Retrieve torrents, if no connection to qBit, return empty array
    // IF WE WEVER DECIDE TO UPDATE SETTINGS IN REMOVE_MISSING, GET NEWSETTINGS FROM HERE
    const { torrents } = await getqBittorrentTorrents(settings, data, "remove_missing")

    // Depending on the amount of library items, logs can hang here so give an indication of how long
    processingTimeMessage(data)

    // Get activeAPIs with updated torrent data and get torrents that do not match any movies or episodes.
    // There's no solid way to sort torrents in qBit so the best way of finding unmatched torrents
    // is by sorting with all movies and episodes together outside of the loop.
    const { updatedActiveAPIs, unmatchedTorrents } = findLibraryTorrents(activeAPIs, torrents)

    let unmatchedDeleted = 0

    // Loop through unmatched torrents, if the torrent has met its seeding quota then delete it.
    const reason = "Superseded"
    for (const torrent of unmatchedTorrents) {
      if (torrentDownloadedCheck(torrent, reason) && torrentSeedCheck(torrent, reason)) {
        deleteqBittorrent(settings, data.qBittorrent.cookie, torrent)
        unmatchedDeleted++
      }
    }

    // Init logging object
    const logging = {
      radarrILItems: 0,
      sonarrILItems: 0,
      radarrLibrary: 0,
      sonarrLibrary: 0,
      torrents: torrents.length,
      unmatchedTorrents: unmatchedTorrents.length,
      unmatchedDeleted,
      markedForDeletion: 0,
      radarrDeleted: 0,
      sonarrDeleted: 0,
    }

    // Loop through each active API
    for (const API of updatedActiveAPIs) {
      // Skip Lidarr... might add later
      if (API.name === "Lidarr") {
        continue
      }

      // Movies from Radarr and Series from Sonarr
      const library = API.data.library as (Movie | Series)[]

      // Ensure library for this API exists
      if (!library) {
        logger.error(`removeMissing: No library data for ${API.name}.`)
        continue
      }

      // Each Starr API has a different library
      if (API.name === "Radarr") {
        logging.radarrLibrary = library.length
      } else if (API.name === "Sonarr") {
        logging.sonarrLibrary = library.length
      }

      // Init an Array of library items identified for deletion
      let itemsForDeletion: (Movie | Series)[] = []

      // If Import Lists is the selected level
      if (settings.remove_missing_level === "Import List") {
        // Skip if this API has no import lists
        if (!API.data.importLists || API.data.importLists.length === 0) {
          logger.warn(`removeMissing: ${API.name} has no Import Lists.`)
          continue
        }

        // An array of items from import lists from various list APIs such as mdbList
        const importListItems = await getMdbListItems(API)

        // Log the amount of import list items for each Starr app API
        if (API.name === "Radarr") {
          logging.radarrILItems = importListItems.length
        } else if (API.name === "Sonarr") {
          logging.sonarrILItems = importListItems.length
        }

        // Create a Set of all identifiers for quick lookups
        const tmdbSet = new Set(importListItems.map((item) => item.id))
        const imdbSet = new Set(importListItems.map((item) => item.imdb_id))
        const tvdbSet = new Set(importListItems.map((item) => item.tvdbid).filter(Boolean)) // Exclude null/undefined

        // Filter the library for items not in the import list
        for (const libraryItem of library) {
          const matchesTmdb = tmdbSet.has(libraryItem.tmdbId)
          const matchesImdb = imdbSet.has(libraryItem.imdbId)
          const matchesTvdb = "tvdbId" in libraryItem && tvdbSet.has(libraryItem.tvdbId)

          // If no match is found, add this libraryItem to the array
          if (!matchesTmdb && !matchesImdb && !matchesTvdb) {
            itemsForDeletion.push(libraryItem)
          }
        }

        // Init an array to filter deleted items from so we can update the db
        let filteredLibrary = library

        // Ensure we don't remove any items that appear in bot user pools
        let userPool: Movie[] | Series[]

        if (API.name === "Radarr") {
          userPool = settings.general_bot.users.flatMap((u) => u.pool.movies)
        } else {
          userPool = settings.general_bot.users.flatMap((u) => u.pool.series)
        }

        const userPoolIds = new Set(userPool.map((p) => p.id))
        const removedItems = itemsForDeletion.filter((item) => userPoolIds.has(item.id))

        // Log removed items with associated user name(s)
        removedItems.forEach((item) => {
          const usersWithItem = settings.general_bot.users
            .filter((user) =>
              (API.name === "Radarr" ? user.pool.movies : user.pool.series).some(
                (p) => p.id === item.id,
              ),
            )
            .map((user) => user.name)

          logger.info(
            `${API.name}: Skipping ${
              item.title
            } — it's not in any Import List, but it's still part of ${usersWithItem.join(
              ", ",
            )}'s pool. 🔒`,
          )
        })

        // Filter user pool items out
        itemsForDeletion = itemsForDeletion.filter((item) => !userPoolIds.has(item.id))

        // If some library items have been selected for deletion filter any that should not be deleted
        if (itemsForDeletion.length > 0) {
          // itemsForDeletion will obviously be different per API so needs to accumulate
          logging.markedForDeletion = logging.markedForDeletion + itemsForDeletion.length

          // Loop through all of the updated library items that now has torrent data
          for (const libraryItem of itemsForDeletion) {
            const deleteFromLibraryHelper = async () => {
              // Delete libraryItem from Starr app library as well as usenet downloader and storage
              if (await deleteFromLibrary(libraryItem, API)) {
                // On request succes remove deleted library item from filteredLibrary
                filteredLibrary = filteredLibrary.filter((item) => item.id !== libraryItem.id)
                // Log the deletions
                if (API.name === "Radarr") {
                  logging.radarrDeleted++
                } else if (API.name === "Sonarr") {
                  logging.sonarrDeleted++
                }
              }
            }

            // Check if the Radarr or Sonarr libraryItem has been matched to any torrent
            const noTorrents = isMovie(libraryItem)
              ? !libraryItem.torrent
              : !libraryItem.torrentsPresent

            // If the libraryItem hasn't been matched to any torrent, it's a usenet download and is ok to delete.
            if (noTorrents) {
              await deleteFromLibraryHelper()
              continue
            }

            // Create an array of torrents associated with this libraryItem
            const torrentFiles = isMovie(libraryItem)
              ? [libraryItem.torrentFile]
              : libraryItem.seasons.flatMap(
                  (season) => season.episodes?.map((ep) => ep.torrentFile) || [],
                )

            // Check if all torrents have met their seed criteria
            const torrentsReady = torrentFiles.every((t) =>
              t ? torrentSeedCheck(t, t.torrentType) : true,
            )

            // If every torrent that belongs to the libraryItem is met its requirements, delete the libraryItem.
            if (torrentsReady) {
              await deleteFromLibraryHelper()
            }
          }

          // Update Library data in db with the removed library items.
          data.libraries = data.libraries.map((item) => {
            if (item.name === API.name) {
              return {
                ...item,
                data: filteredLibrary,
                updated_at: moment().format(),
              }
            }

            return item // Return other libraries unchanged
          })
        }

        // If we've deleted some items from Starr app libraries, update libraries in db
        // We are adding updatedLibrary to the db but we don't mind this
        if (itemsForDeletion.length > 0 && filteredLibrary.length < library.length) {
          data.updated_at = moment().format()
          await saveWithRetry(data, "remove_missing")
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

            if (API.name === "Radarr") {
              logging.radarrDeleted++
            } else if (API.name === "Sonarr") {
              logging.sonarrDeleted++
            }
          }
        }
      }

      const deleted = API.name === "Radarr" ? logging.radarrDeleted : logging.sonarrDeleted

      logger.success(
        `Remove Missing ${API.name} | Level: ${settings.remove_missing_level}. Library: ${library.length}. Deleted: ${deleted}.`,
      )
    }
  },
  // prettier-ignore
  tidy_directories: async (settings: settingsType): Promise<void> => {
    if (process.env.NODE_ENV === "development") {
      logger.info("tidyDirectories bypassed. In Development mode... risky stuff!")
      return
    }

    // Return if there are no paths and there's nothing to do
    if (settings.tidy_directories_paths.length === 0) {
      logger.warn("tidyDirectories: No paths found.")
      return
    }

    // An object for logging
    const tidying = {
      paths: 0,
      children: 0,
      allowed: 0,
      notAllowed: 0,
    }

    // Loop through all the paths we need to tidy
    for (const tidyPath of settings.tidy_directories_paths) {
      tidying.paths++
      const children = getChildPaths(tidyPath.path)

      // Loop through all of the children and check if each child is allowed
      for (const child of children) {
        tidying.children++
        const allowed = tidyPath.allowedDirs.some((d) => d === child)

        if (!allowed) {
          tidying.notAllowed++
          const requiredCount = 3

          const updatedCount = await counter(child, () => {
            deleteFromMachine(child)
          }, requiredCount)

          const loopsLeft = requiredCount - updatedCount

          if (requiredCount === updatedCount) {
            logger.success(`tidyDirectories: ${child} has been deleted from ${tidyPath.path}.`)
          } else {
            logger.warn(`${child} is not allowed in ${tidyPath.path} and will be deleted in ${loopsLeft} loop${loopsLeft === 1 ? "" : "s"}.`)
          }
        } else {
          tidying.allowed++
          counterTracking.delete(child)
        }
      }
    }

    if (tidying.notAllowed === 0) {
      const singular = tidying.paths === 1
      logger.success(`tidyDirectories: All children are allowed out of ${tidying.children} children in ${tidying.paths} path${singular ? "" : "s"}.`)
    }
  },
}

export default coreResolvers
