import moment from "moment"
import { DownloadStatus, graphqlErr } from "../types/types"
import { APIData } from "./activeAPIsArr"
import { baseData, dataType, downloadQueue } from "../models/data"
import logger from "../logger"
import { settingsDocType, settingsType } from "../models/settings"
import { dynamicLoop } from "./dynamicLoop"
import Resolvers from "../graphql/resolvers/resolvers"
import { Movie } from "../types/movieTypes"
import { Series } from "../types/seriesTypes"
import { Torrent } from "../types/qBittorrentTypes"

// Simple calculations
export const minsToSecs = (mins: number): number => mins * 60
export const minsToMillisecs = (mins: number): number => mins * 60000
export const secsToMins = (secs: number): number => secs / 60

// Simple string mutations
export const capsFirstLetter = (str: string): string => str.charAt(0).toUpperCase() + str.slice(1)

// Simple request response success indication
export const requestSuccess = (status: number): boolean => status >= 200 && status < 300

// Form easy to read request error messages
export const errCodeAndMsg = (err: unknown): string => {
  try {
    const error = err as graphqlErr
    const res = error?.response
    const status = res?.status ?? "Unknown Status"
    const message = res?.data?.message ?? res?.statusText ?? "Unknown Message"
    const errors = res?.data?.errors ? res.data.errors : []

    return `${status} - ${errors.length !== 0 ? JSON.stringify(errors) : message}`
  } catch (e) {
    return "Unknown Error - Failed to extract error details."
  }
}

// Clean up a URL string removing any unneeded double forward slashes
export const cleanUrl = (url: string): string => url.replace(/([^:]\/)\/+/g, "$1")

// Ensure a string is of POSIX standard
export const isPosix = (str: string): boolean => /^[a-zA-Z][a-zA-Z0-9_.-]{0,31}$/.test(str)
// Ensure a string is of a three-digit octal mode representation for commands such as chmod
export const isThreeDigitOctal = (str: string) => /^[0-7]{3}$/.test(str)

// Return the name of the library content for one of the Starr apps
// Optionally, ask for an alternative to differ from the default return string
export const getContentName = (API: APIData, alt?: boolean, plural?: boolean): string => {
  let content = "movie"

  switch (API.name) {
    case "Radarr":
      content = "movie"
      break
    case "Sonarr":
      content = alt ? "episode" : "series" // dataset not checked
      break
    case "Lidarr":
      content = "artist"
      break
    default:
      content = "movie"
      break
  }

  // If plural is true, add "s" to the end of the string unless it already ends with "s"
  if (plural && !content.endsWith("s")) {
    content += "s"
  }

  return content
}

// Return the content ID of a DownloadStatus object
export const getDownloadContentID = (download: DownloadStatus): number | null => {
  if (download.movieId !== undefined) return download.movieId
  if (download.seriesId !== undefined) return download.seriesId
  if (download.albumId !== undefined) return download.albumId
  return null // No ID found
}

// prettier-ignore
type momentTimeUnit = "years" | "months" | "weeks" | "days" | "hours" | "minutes" | "seconds" | "milliseconds"

// Return true if enough time has passed since a databse object was last updated.
// Pass the check if the object was created in the past minute.
export const checkTimePassed = (
  wait: number,
  unit: momentTimeUnit,
  updated_at?: string,
): boolean => {
  // If no timing data is passed, most likely due to an object not existing, return true.
  if (!updated_at) {
    return true
  }

  // If the db object was updated longer ago than the wait time, return true.
  return moment().diff(moment(updated_at), unit) >= wait
}

// Boilerplate for adding standard fields to objects in data in db
export const dataBoilerplate = <T extends baseData | { _doc: baseData }>(
  API: APIData,
  dataArr: T[],
): baseData => {
  // Search for the item with matching name or _doc.name
  const APIData = dataArr
    .map((d) => {
      if ("_doc" in d) {
        return d._doc.name === API.name ? d._doc : null // If _doc exists, return _doc
      }
      return d.name === API.name ? d : null // Otherwise, check directly on name
    })
    .find((item) => item !== null) // Find the first non-null item

  // If no match is found, create a new APIData object with default fields
  if (!APIData) {
    return {
      name: API.name,
      created_at: moment().format(),
      updated_at: moment().format(),
    }
  }

  // Since APIData is guaranteed to be of type baseData here, return it
  return {
    ...APIData,
    updated_at: moment().format(),
  } as baseData
}

// Update the data db object with latest queue information.
export const updateDownloadQueue = (
  API: APIData,
  data: dataType,
  queue?: downloadQueue, // If we have the queue object from a successfull getQueue request, use it.
  blockedFile?: DownloadStatus, // If we have a blockedFile, remove it from the newQueue.
): downloadQueue => {
  // If no queue, create a downloadQueue object with no data
  if (!queue) {
    return {
      ...dataBoilerplate(API, data.downloadQueues),
      data: [],
    }
  }

  // Create a new Queue object with the removed blockedFile
  const newQueue: downloadQueue = {
    ...dataBoilerplate(API, data.downloadQueues),
    data: blockedFile ? queue.data.filter((q) => q.id !== blockedFile.id) : queue.data,
  }

  // Check if a queue with the same name already exists
  const existingQueueIndex = data.downloadQueues.findIndex((q) => q.name === queue.name)

  if (existingQueueIndex >= 0) {
    // Update the existing queue
    data.downloadQueues[existingQueueIndex] = newQueue
  } else {
    // Add newQueue if it doesn't exist in data.downloadQueues
    data.downloadQueues.push(newQueue)
  }

  // This function assumes we're updating the data db object with data.save() later
  return newQueue
}

// Check if qBittorrent data exists for currentPaths function
export const qBittorrentDataExists = (data: dataType): boolean => {
  const noqBit =
    !data.qBittorrent ||
    (data.qBittorrent.categories.length === 0 &&
      Object.keys(data.qBittorrent.preferences || {}).length === 0)

  if (noqBit) {
    return false
  } else {
    return true
  }
}

// Create an array of path strings
export const currentPaths = (data: dataType): string[] => {
  let paths: string[] = []

  // If there's no qBittorrent data to check, return
  if (!qBittorrentDataExists(data)) {
    logger.warn("currentPaths: qBittorrent data required.")
    return paths
  }

  // Add all qBittorrent download location paths
  if (data.qBittorrent.categories.length > 0) {
    for (const qBitCat of data.qBittorrent.categories) {
      paths.push(qBitCat.savePath)
    }
  }

  const prefs = data.qBittorrent.preferences

  // If data.qBittorrent.preferences is populated
  if (prefs && Object.keys(prefs).length > 0) {
    paths.push(prefs.save_path)

    // If the temp path is in use, add it
    if (prefs.temp_path_enabled) {
      paths.push(prefs.temp_path)
    }
  }

  return paths
}

// Check to see if all Loops are deactivated
export const allLoopsDeactivated = (settings: settingsType): boolean => {
  const allDeactivated =
    settings &&
    Object.keys(settings)
      .filter((key) => key.endsWith("_loop")) // Find keys ending with '_loop'
      .map((loopKey) => settings[loopKey.replace("_loop", "")]) // Map to the corresponding value
      .every((loop) => loop === false) // Check if every array item is false

  if (allDeactivated) {
    logger.warn(`All Loops are deactivated. This is fine... ¿ⓧ_ⓧﮌ`)
    return true
  }

  return false
}

// Check to see if all API's are deactivated
export const allAPIsDeactivated = (settings: settingsType): boolean => {
  const allDeactivated =
    settings &&
    Object.entries(settings)
      .filter(([key]) => key.endsWith("_active"))
      .every(([_, val]) => !val)

  if (allDeactivated) {
    logger.warn(`Every API is deactivated. First time?`)
    return true
  }

  return false
}

// Start looping through all of the core loops
// prettier-ignore
export const coreLoops = async (skipFirst?: boolean): Promise<void> => {
  // Retrieve the latest API data and add to database
  await dynamicLoop("get_data", async () => {
    await Resolvers.getData()
  }, true, 60)
  // Check for monitored content in libraries that has not been downloaded and is wanted missing.
  await dynamicLoop("wanted_missing_loop", async (settings) => {
    await Resolvers.search_wanted_missing(settings)
  }, skipFirst)
  // Check if any items in queues can not be automatically imported. If so, handle it depending on why.
  await dynamicLoop("import_blocked_loop", async (settings) => {
    await Resolvers.import_blocked_handler(settings)
  }, skipFirst)
  // Check for any failed downloads and delete them from the file system.
  await dynamicLoop("remove_failed_loop", async () => {
    await Resolvers.remove_failed()
  }, skipFirst)
  // Check for any failed downloads and delete them from the file system.
  await dynamicLoop("remove_missing_loop", async (settings) => {
    await Resolvers.remove_missing(settings)
  }, skipFirst)
  // Remove all unwanted files and directories in the provided paths.
  await dynamicLoop("tidy_directories_loop", async (settings) => {
    await Resolvers.tidy_directories(settings)
  }, skipFirst)
  // Change ownership of Starr app root folders to users preference. (Useful to change ownership to Plex user)
  await dynamicLoop("permissions_change_loop", async (settings) => {
    await Resolvers.permissions_change(settings)
  }, skipFirst)
}

// Call all core loop functions once
export const coreFunctionsOnce = async (settings: settingsDocType): Promise<void> => {
  // Check for monitored content in libraries that has not been downloaded and is wanted missing.
  if (settings.wanted_missing) {
    await Resolvers.search_wanted_missing(settings._doc)
  }
  // Check if any items in queues can not be automatically imported. If so, handle it depending on why.
  if (settings.import_blocked) {
    await Resolvers.import_blocked_handler(settings._doc)
  }
  // Check for any failed downloads and delete them from the file system.
  if (settings.remove_failed) {
    await Resolvers.remove_failed()
  }
  // Check for any failed downloads and delete them from the file system.
  if (settings.remove_missing) {
    await Resolvers.remove_missing(settings._doc)
  }
  // Remove all unwanted files and directories in the provided paths.
  if (settings.tidy_directories) {
    await Resolvers.tidy_directories(settings._doc)
  }
  // Change ownership of Starr app root folders to users preference. (Useful to change ownership to Plex user)
  if (settings.permissions_change) {
    await Resolvers.permissions_change(settings._doc)
  }
}

// Takes a string and splits words by full stops or spaces and returns them in an array
export const extractStringWords = (filename: string): string[] => {
  const match = filename.match(/^(.*?)\s\(\d{4}\)/)
  if (match && match[1]) {
    return match[1].match(/\b\w+\b/g) || []
  }
  return []
}

// Takes in Starr app library items and compares them to torrents in qBittorrent.
// For every library item that has a matching torrent, add and populate torrent fields.
// Return all library items that have a matching torrent with new torrent data.
export const findLibraryTorrents = (
  library: (Movie | Series)[],
  torrents: Torrent[],
): {
  updatedLibrary: (Movie | Series)[] // Array of all library items including updated items
  unmatchedTorrents: Torrent[] // Array of torrents that could not be matched to a library item
} => {
  const libraryMatches: (Movie | Series)[] = []

  // Loop through starr app libraries
  for (const item of library) {
    const mov = item as Movie

    // If a movie file exists. I.E if a file it attached to the library item.
    if (mov.movieFile) {
      // Create an array of strings to find a torrent object with
      const matchStrings = extractStringWords(mov.movieFile.relativePath)
      // Add resolution to the array
      matchStrings.push(mov.movieFile.quality.quality.resolution.toString())
      // Add release group to the array
      matchStrings.push(mov.movieFile.releaseGroup.toLowerCase())
      // For each library item, find a matching torrent using the matchStrings
      const torrentMatch = torrents.find((torrent) => {
        // Format the torrent name into a string that can easily be matched with
        const formattedTorrentName = torrent.name.toLowerCase().replace(/'/g, "")
        // Check if every string in matchStrings can be found in any torrent name
        const stringsMatch = matchStrings.every((str) =>
          formattedTorrentName.includes(str.toLowerCase()),
        )
        // If a seconday year can be found for a file, use it
        const secondaryYear = mov.secondaryYear ? mov.secondaryYear.toString() : "No Secondary Year"

        // Check if either year or secondaryYear matches the year in the torrent name
        const yearsMatch =
          torrent.name.includes(mov.year.toString()) || torrent.name.includes(secondaryYear)

        // If stringsMatch and yearsMatch is truthy then return this torrent
        return stringsMatch && yearsMatch
      })

      // If there is a match, push it to the matches array
      if (torrentMatch) {
        libraryMatches.push({
          ...mov,
          torrent: true,
          torrentFile: torrentMatch,
        })
      }
    }
  }

  const unmatchedTorrents: Torrent[] = []

  // If torrent not matched to a library item, add it to the unmatchedTorrents array.
  // Likely this is due to a Starr app "upgrade" leading to two or more downloads of the same film or episode.
  for (const torrent of torrents) {
    const unmatchedTorrent = !libraryMatches.some((item) => {
      const mov = item as Movie
      return mov.torrentFile?.name === torrent.name
    })

    if (unmatchedTorrent) {
      unmatchedTorrents.push(torrent)
    }
  }

  // Create an array of all given library items including updated items
  const updatedLibrary = library.map((item) => libraryMatches.find((i) => i.id === item.id) || item)

  return {
    updatedLibrary,
    unmatchedTorrents,
  }
}
