import { settingsType } from "../models/settings"
import logger from "../logger"
import { activeAPIsArr } from "../shared/activeAPIsArr"
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
import { deleteqBittorrent, getqBittorrentTorrents } from "../shared/qBittorrentRequests"
import { incrementMovieDeletions, incrementSeriesDeletions } from "../shared/statsCollector"
import { matchesPoolItem } from "./loopUtility"

// Generate lookup keys for matching items
const generateLookupKeys = (item: Movie | Series): string[] => {
  const keys: string[] = []

  if (item.tmdbId) keys.push(`tmdb:${item.tmdbId}`)
  if (item.imdbId) keys.push(`imdb:${item.imdbId}`)
  if ("tvdbId" in item && item.tvdbId) keys.push(`tvdb:${item.tvdbId}`)

  return keys
}

// Create user pool lookup structure
const createUserPoolLookup = (userPool: (Movie | Series)[]) => {
  const lookup = new Map<string, Set<string>>()

  for (const poolItem of userPool) {
    const keys = generateLookupKeys(poolItem)
    keys.forEach((key) => {
      if (!lookup.has(key)) {
        lookup.set(key, new Set())
      }
      lookup.get(key)!.add(poolItem.id?.toString() || poolItem.tmdbId?.toString() || "unknown")
    })
  }

  return lookup
}

// Check if item is in user pool
const isInUserPoolOptimized = (
  libraryItem: Movie | Series,
  userPoolLookup: Map<string, Set<string>>,
  userPool: (Movie | Series)[],
  apiName: string,
): boolean => {
  // Check if item matches any pool items
  const keys = generateLookupKeys(libraryItem)
  const hasMatch = keys.some((key) => userPoolLookup.has(key))

  if (hasMatch) {
    // Confirm with detailed matching logic
    return userPool.some((poolItem) => matchesPoolItem(poolItem, libraryItem, apiName))
  }

  return false
}

// Process deletions in batches
const processDeletionsInBatches = async <T>(
  items: T[],
  processor: (item: T) => Promise<boolean>,
  batchSize: number = 5,
): Promise<T[]> => {
  const processedItems: T[] = []

  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize)
    const results = await Promise.allSettled(
      batch.map(async (item) => {
        try {
          const processed = await processor(item)
          return { item, processed }
        } catch (error) {
          logger.error(`Error processing item: ${error}`)
          return { item, processed: false }
        }
      }),
    )

    results.forEach((result) => {
      if (result.status === "fulfilled" && result.value.processed) {
        processedItems.push(result.value.item)
      }
    })
  }

  return processedItems
}

const remove_missing = async (settings: settingsType): Promise<void> => {
  if (!settings.qBittorrent_active) {
    logger.error("Remove Missing: qBittorrent is required for this loop.")
    return
  }

  // Only get data for API's that have been checked and are active
  const { data, activeAPIs } = await activeAPIsArr(settings)

  // Retrieve torrents, if no connection to qBit, return empty array
  const { torrents, cookieRenewed, cookie, cookie_expiry } = await getqBittorrentTorrents(
    settings,
    data,
    "remove_missing",
  )

  // If we have a new qbittorrent cookie
  if (cookieRenewed && cookie && cookie_expiry) {
    data.qBittorrent.cookie = cookie
    data.qBittorrent.cookie_expiry = cookie_expiry
    data.qBittorrent.updated_at = moment().format()
  }

  // Log processing time estimate for large libraries
  processingTimeMessage(data, activeAPIs)

  // Get activeAPIs with updated torrent data and get torrents that do not match any movies or episodes.
  // There's no solid way to sort torrents in qBit so the best way of finding unmatched torrents
  // is by sorting with all movies and episodes together outside of the loop.
  const { updatedActiveAPIs, unmatchedTorrents } = findLibraryTorrents(activeAPIs, torrents)

  let unmatchedDeleted = 0

  // Superseded torrent tracking for summary report
  let supersededDownloading = 0
  let supersededWaitingSeeding = 0
  let supersededWaitingTime = 0
  let supersededOtherStates = 0

  // Loop through unmatched torrents, if the torrent has met its seeding quota then delete it.
  const reason = "Superseded"
  for (const torrent of unmatchedTorrents) {
    const isDownloaded = torrentDownloadedCheck(torrent, reason, settings.verbose_logging)
    const hasMetSeedRequirements = torrentSeedCheck(torrent, reason, settings.verbose_logging)

    if (isDownloaded && hasMetSeedRequirements) {
      deleteqBittorrent(settings, data.qBittorrent.cookie, torrent)
      unmatchedDeleted++
    } else if (!settings.verbose_logging) {
      // Track reasons for non-verbose summary
      if (torrent.state === "downloading") {
        supersededDownloading++
      } else if (isDownloaded && !hasMetSeedRequirements) {
        const { ratio, ratio_limit, seeding_time, seeding_time_limit } = torrent
        const seeding_time_mins = Number((seeding_time / 60).toFixed(0))

        if (ratio < ratio_limit) {
          supersededWaitingSeeding++
        } else if (seeding_time_mins < seeding_time_limit) {
          supersededWaitingTime++
        }
      } else {
        supersededOtherStates++
      }
    }
  }

  // Log superseded torrent summary if verbose logging is disabled
  if (!settings.verbose_logging && unmatchedTorrents.length > 0) {
    const summaryParts = []
    if (supersededDownloading > 0) summaryParts.push(`${supersededDownloading} downloading`)
    if (supersededWaitingSeeding > 0)
      summaryParts.push(`${supersededWaitingSeeding} awaiting ratio`)
    if (supersededWaitingTime > 0) summaryParts.push(`${supersededWaitingTime} awaiting time`)
    if (supersededOtherStates > 0) summaryParts.push(`${supersededOtherStates} other states`)
    if (unmatchedDeleted > 0) summaryParts.push(`${unmatchedDeleted} deleted`)

    const summary = summaryParts.length > 0 ? ` (${summaryParts.join(", ")})` : ""
    logger.info(`Superseded torrents: ${unmatchedTorrents.length} processed${summary}`)
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
    // Detailed tracking for summary reports
    radarrTorrentStats: {
      waitingRatio: 0,
      waitingTime: 0,
      downloading: 0,
      otherStates: 0,
      usenetDeleted: 0,
      torrentDeleted: 0,
      userProtected: 0,
    },
    sonarrTorrentStats: {
      waitingRatio: 0,
      waitingTime: 0,
      downloading: 0,
      otherStates: 0,
      usenetDeleted: 0,
      torrentDeleted: 0,
      userProtected: 0,
    },
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
      logger.error(`Remove Missing | ${API.name} | No library data.`)
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
        logger.warn(`Remove Missing | ${API.name} | has no Import Lists.`)
        continue
      }

      // An array of items from import lists from various list APIs such as mdbList
      const { importListItems, newListItems, listsError } = await getMdbListItems(API)

      if (listsError) {
        logger.warn(
          `Remove Missing | ${API.name} | Stopped execution due to getMdbListItems error.`,
        )
        return
      }

      // If importListItems is still empty, don't go any further
      if (importListItems.length === 0) {
        logger.error(`Remove Missing | ${API.name} | No Import list data. Skipping...`)
        continue
      }

      if (importListItems.length > 0 && !newListItems) {
        logger.warn(
          `Remove Missing | ${API.name} | No new mdbLists could be retreived. Falling back to lists in the databse.`,
        )
      }

      // Replace list items with new ones in database
      if (newListItems) {
        data.importLists = data.importLists.map((il) => {
          if (il.name === API.name) {
            return {
              ...il,
              listItems: newListItems,
              updated_at: moment().format(),
            }
          }
          return il
        })
      }

      // Track import list item counts
      if (API.name === "Radarr") {
        logging.radarrILItems = importListItems.length
      } else if (API.name === "Sonarr") {
        logging.sonarrILItems = importListItems.length
      }

      // Create a Set of all identifiers for matching
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

      // Track library items for database update
      let filteredLibrary = library

      // Ensure we don't remove any items that appear in bot user pools
      let userPool: Movie[] | Series[]

      if (API.name === "Radarr") {
        userPool = settings.general_bot.users.flatMap((u) => u.pool.movies)
      } else {
        userPool = settings.general_bot.users.flatMap((u) => u.pool.series)
      }

      // Create lookup structure for user pool matching
      const userPoolLookup = createUserPoolLookup(userPool)

      // Check if library item is in user pool
      const isInUserPool = (libraryItem: Movie | Series): boolean =>
        isInUserPoolOptimized(libraryItem, userPoolLookup, userPool, API.name)

      const removedItems = itemsForDeletion.filter(isInUserPool)

      // Track user protected items for summary
      const currentStats =
        API.name === "Radarr" ? logging.radarrTorrentStats : logging.sonarrTorrentStats
      currentStats.userProtected = removedItems.length

      // Group removed items by user
      const userPoolMaps = new Map<string, Map<string, Set<string>>>()
      const userSkippedMap: Record<string, string[]> = {}

      // Build lookup maps for each user
      for (const user of settings.general_bot.users) {
        const pool = API.name === "Radarr" ? user.pool.movies : user.pool.series
        userPoolMaps.set(user.name, createUserPoolLookup(pool))
      }

      // Check which user owns each removed item
      for (const item of removedItems) {
        for (const user of settings.general_bot.users) {
          const userLookup = userPoolMaps.get(user.name)!
          const pool = API.name === "Radarr" ? user.pool.movies : user.pool.series

          // Check if item matches user's pool
          if (isInUserPoolOptimized(item, userLookup, pool, API.name)) {
            if (!userSkippedMap[user.name]) {
              userSkippedMap[user.name] = []
            }
            userSkippedMap[user.name].push(item.title)
          }
        }
      }

      // Log one message per user with their skipped titles
      if (settings.verbose_logging) {
        const singular = API.name === "Radarr" ? "movie" : "series"
        const plural = API.name === "Radarr" ? "movies" : "series"

        for (const [user, titles] of Object.entries(userSkippedMap)) {
          logger.info(
            `Remove Missing | ${API.name} | Skipping ${titles.length} ${
              titles.length < 2 ? singular : plural
            } in ${user}'s pool: [${titles.join(", ")}] 🔒`,
          )
        }
      }

      // Filter user pool items out
      itemsForDeletion = itemsForDeletion.filter((item) => !isInUserPool(item))

      // Process library items selected for deletion
      if (itemsForDeletion.length > 0) {
        // Track total items marked for deletion across APIs
        logging.markedForDeletion = logging.markedForDeletion + itemsForDeletion.length

        // Create deletion processor function
        const deleteItemProcessor = async (libraryItem: Movie | Series): Promise<boolean> => {
          const deleteFromLibraryHelper = async (): Promise<boolean> => {
            if (!isDocker) {
              logger.info(
                `Remove Missing | ${API.name} | ${libraryItem.title} Skipped deletion. Running in development mode. 🧊`,
              )
              return false
            }

            // Delete libraryItem from Starr app library as well as usenet downloader and storage
            if (await deleteFromLibrary(libraryItem, API)) {
              // Update stats - deleteFromLibrary already handles the deletion logging
              if (API.name === "Radarr") {
                logging.radarrDeleted++
                await incrementMovieDeletions(1)
              } else if (API.name === "Sonarr") {
                logging.sonarrDeleted++
                // For series, we need to count episodes if available
                const episodeCount = (libraryItem as Series).statistics?.episodeFileCount || 0
                await incrementSeriesDeletions(1, episodeCount)
              }
              return true
            }
            return false
          }

          // Check if the Radarr or Sonarr libraryItem has been matched to any torrent
          const noTorrents = isMovie(libraryItem)
            ? !libraryItem.torrent
            : !libraryItem.torrentsPresent

          // If the libraryItem hasn't been matched to any torrent, it's a usenet download and is ok to delete.
          if (noTorrents) {
            const success = await deleteFromLibraryHelper()
            if (success) {
              // Track usenet deletions
              const currentStats =
                API.name === "Radarr" ? logging.radarrTorrentStats : logging.sonarrTorrentStats
              currentStats.usenetDeleted++
            }
            return success
          }

          // Create an array of torrents associated with this libraryItem
          const torrentFiles = isMovie(libraryItem)
            ? [libraryItem.torrentFile]
            : libraryItem.seasons.flatMap(
                (season) => season.episodes?.map((ep) => ep.torrentFile) || [],
              )

          // Track torrent statistics for non-verbose mode
          if (!settings.verbose_logging) {
            const currentStats =
              API.name === "Radarr" ? logging.radarrTorrentStats : logging.sonarrTorrentStats

            torrentFiles.forEach((t) => {
              if (!t) return

              const { state, ratio, ratio_limit, seeding_time, seeding_time_limit } = t
              const seeding_time_mins = Number((seeding_time / 60).toFixed(0))

              if (state === "downloading") {
                currentStats.downloading++
              } else if (state === "stalledUP" || state === "uploading" || state === "pausedUP") {
                if (ratio < ratio_limit) {
                  currentStats.waitingRatio++
                } else if (seeding_time_mins < seeding_time_limit) {
                  currentStats.waitingTime++
                }
              } else {
                currentStats.otherStates++
              }
            })
          }

          // Check if all torrents have met their seed criteria
          const torrentsReady = torrentFiles.every((t) => {
            if (!t) return true

            const seedCheckResult = torrentSeedCheck(t, t.torrentType, settings.verbose_logging)

            return seedCheckResult
          })

          // If every torrent that belongs to the libraryItem is met its requirements, delete the libraryItem.
          if (torrentsReady) {
            const success = await deleteFromLibraryHelper()
            if (success) {
              // Track torrent deletions
              const currentStats =
                API.name === "Radarr" ? logging.radarrTorrentStats : logging.sonarrTorrentStats
              currentStats.torrentDeleted++
            }
            return success
          }

          return false
        }

        // Process deletions in batches with controlled concurrency
        const deletedItems = await processDeletionsInBatches(
          itemsForDeletion,
          deleteItemProcessor,
          3, // Process 3 deletions concurrently to avoid overwhelming the API
        )

        // Update filteredLibrary by removing successfully deleted items
        const deletedItemIds = new Set(deletedItems.map((item) => item.id))
        filteredLibrary = filteredLibrary.filter((item) => !deletedItemIds.has(item.id))

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
      if (itemsForDeletion.length > 0 && filteredLibrary.length < library.length) {
        data.updated_at = moment().format()
        await saveWithRetry(data, "remove_missing")
      }
    }

    // If we're just checking if there's anything in the file system that isn't in the library
    if (settings.remove_missing_level === "Library") {
      // Check we have root folder path
      if (!API.data.rootFolder) {
        logger.error(`Remove Missing | ${API.name} | Root folder data missing for ${API.name}.`)
        continue
      }

      // Retrieve an array of paths for the root folder
      const rootChildrenPaths = getChildPaths(API.data.rootFolder.path)

      // Create a Set of paths for all current library items
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

    if (settings.verbose_logging) {
      logger.success(
        `Remove Missing | ${API.name} | Level: ${settings.remove_missing_level}. Library: ${library.length}. Deleted: ${deleted}.`,
      )
    } else {
      // Enhanced summary with detailed statistics
      const stats = API.name === "Radarr" ? logging.radarrTorrentStats : logging.sonarrTorrentStats
      const importListItems = API.name === "Radarr" ? logging.radarrILItems : logging.sonarrILItems

      const summaryParts = []
      if (stats.usenetDeleted > 0) summaryParts.push(`${stats.usenetDeleted} usenet deletions`)
      if (stats.torrentDeleted > 0) summaryParts.push(`${stats.torrentDeleted} torrent deletions`)
      if (stats.downloading > 0) summaryParts.push(`${stats.downloading} downloading`)
      if (stats.waitingRatio > 0) summaryParts.push(`${stats.waitingRatio} awaiting ratio`)
      if (stats.waitingTime > 0) summaryParts.push(`${stats.waitingTime} awaiting time`)
      if (stats.otherStates > 0) summaryParts.push(`${stats.otherStates} other states`)

      const summary = summaryParts.length > 0 ? ` (${summaryParts.join(", ")})` : ""
      const importListInfo = importListItems > 0 ? ` Import Lists: ${importListItems}.` : ""
      const userProtectedInfo =
        stats.userProtected > 0 ? ` User Protected: ${stats.userProtected}.` : ""

      logger.success(
        `Remove Missing | ${API.name} | Level: ${settings.remove_missing_level}. Library: ${library.length}.${importListInfo}${userProtectedInfo}${summary}`,
      )
    }
  }

  // Save the changes to data to the database
  await saveWithRetry(data, "remove_missing")
}

export default remove_missing
