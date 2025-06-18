import { settingsType } from "../models/settings"
import logger from "../logger"
import { activeAPIsArr } from "../shared/activeAPIsArr"
import { deleteqBittorrent, getqBittorrentTorrents } from "../shared/qBittorrentRequests"
import { processingTimeMessage } from "../shared/utility"
import {
  findLibraryTorrents,
  torrentDownloadedCheck,
  torrentSeedCheck,
} from "../shared/qBittorrentUtility"
import { Movie } from "../types/movieTypes"
import { Series } from "../types/seriesTypes"
import { getMdbListItems } from "../shared/mdbListRequests"
import { deleteFromLibrary } from "../shared/StarrRequests"
import { isMovie } from "../types/typeGuards"
import moment from "moment"
import { saveWithRetry } from "../shared/database"
import { deleteFromMachine, getChildPaths, isDocker } from "../shared/fileSystem"

const remove_missing = async (settings: settingsType): Promise<void> => {
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
  processingTimeMessage(data, activeAPIs)

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
      const singular = API.name === "Radarr" ? "movie" : "series"
      const plural = API.name === "Radarr" ? "movies" : "series"

      // Group removed items by user
      const userSkippedMap: Record<string, string[]> = {}

      for (const item of removedItems) {
        for (const user of settings.general_bot.users) {
          const pool = API.name === "Radarr" ? user.pool.movies : user.pool.series
          if (pool.some((p) => p.id === item.id)) {
            if (!userSkippedMap[user.name]) {
              userSkippedMap[user.name] = []
            }
            userSkippedMap[user.name].push(item.title)
          }
        }
      }

      // Log one message per user with their skipped titles
      for (const [user, titles] of Object.entries(userSkippedMap)) {
        logger.info(
          `${API.name}: Skipping ${titles.length} ${
            titles.length < 2 ? singular : plural
          } in ${user}'s pool: [${titles.join(", ")}] 🔒`,
        )
      }

      // Filter user pool items out
      itemsForDeletion = itemsForDeletion.filter((item) => !userPoolIds.has(item.id))

      // If some library items have been selected for deletion filter any that should not be deleted
      if (itemsForDeletion.length > 0) {
        // itemsForDeletion will obviously be different per API so needs to accumulate
        logging.markedForDeletion = logging.markedForDeletion + itemsForDeletion.length

        // Loop through all of the updated library items that now has torrent data
        for (const libraryItem of itemsForDeletion) {
          const deleteFromLibraryHelper = async () => {
            if (!isDocker) {
              logger.info(
                `${API.name}: ${libraryItem.title} Skipped deletion. Running in development mode. 🧊`,
              )
              return
            }

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
}

export default remove_missing
