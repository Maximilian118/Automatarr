import moment from "moment"
import { DownloadStatus } from "../types/types"
import { APIData } from "./activeAPIsArr"
import { baseData, dataDocType, dataType, downloadQueue } from "../models/data"
import logger from "../logger"
import { settingsType } from "../models/settings"

// Simple calculations
export const minsToSecs = (mins: number): number => mins * 60
export const minsToMillisecs = (mins: number): number => mins * 60000
export const secsToMins = (secs: number): number => secs / 60

// Simple string mutations
export const capsFirstLetter = (str: string): string => str.charAt(0).toUpperCase() + str.slice(1)

// Simple request response success indication
export const requestSuccess = (status: number): boolean => status >= 200 && status < 300

// Takes a string and splits words by full stops or spaces and returns them in an array
export const extractStringWords = (filename: string): string[] => {
  const match = filename.match(/^(.*?)\s\(\d{4}\)/)

  if (match && match[1]) {
    const words = match[1].match(/\b\w+\b/g) || []

    // If the first two words are 'season' and a number, remove them
    if (words[0]?.toLowerCase() === "season" && /^\d+$/.test(words[1])) {
      return words.slice(2)
    }

    return words
  }

  return []
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

// Fun little function to prep people for the processing time
export const processingTimeMessage = (data: dataDocType, activeAPIs: APIData[]) => {
  let libraryLength = 0

  const activeAPINames: string[] = activeAPIs.map((API) => API.name)
  let apiNameString = ""

  if (activeAPINames.length === 1) {
    apiNameString = activeAPINames[0]
  } else if (activeAPINames.length === 2) {
    apiNameString = `${activeAPINames[0]} and ${activeAPINames[1]}`
  } else if (activeAPINames.length > 2) {
    const last = activeAPINames.pop() // remove and store the last item
    apiNameString = `${activeAPINames.join(", ")} and ${last}`
  }

  for (const library of data.libraries) {
    libraryLength = libraryLength + library.data.length
  }
  // prettier-ignore
  if (libraryLength <= 200) {
    logger.info(`Processing ${libraryLength} library items from ${apiNameString}. Give me a challenge at least...`)
  } else if (libraryLength <= 500) {
    logger.info(`Processing ${libraryLength} library items from ${apiNameString}. Give me a sec...`)
  } else if (libraryLength <= 1000) {
    logger.info(`Processing ${libraryLength} library items from ${apiNameString}. Strap in!`)
  } else if (libraryLength <= 10000) {
    logger.info(`Sweet buttered biscuits on a unicycle! Processing ${libraryLength} library items from ${apiNameString}!`)
  } else {
    logger.info(`I haven't seen a mess like this since spaghetti met ceiling fan! Processing ${libraryLength} library items from ${apiNameString}!`)
  }
}

// A function to convert bytes into an readable string
export const formatBytes = (bytesInput: string | number | bigint, decimals = 2): string => {
  if (!bytesInput) return ""

  const sizes = ["B", "KB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"]
  const k = 1024n

  const bytes =
    typeof bytesInput === "bigint"
      ? bytesInput
      : typeof bytesInput === "string"
      ? BigInt(bytesInput)
      : BigInt(Math.floor(bytesInput))

  if (bytes === 0n) return "0B"

  let i = 0
  let temp = bytes
  while (temp >= k && i < sizes.length - 1) {
    temp /= k
    i++
  }

  const value = Number(bytes) / Math.pow(1024, i)
  return `${parseFloat(value.toFixed(decimals))}${sizes[i]}`
}
