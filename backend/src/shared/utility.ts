import moment from "moment"
import { DownloadStatus, graphqlErr } from "../types/types"
import { APIData } from "./activeAPIsArr"
import { baseData, dataType, downloadQueue } from "../models/data"
import logger from "../logger"

// Simple calculations
export const minsToSecs = (mins: number): number => mins * 60
export const minsToMillisecs = (mins: number): number => mins * 60000
export const secsToMins = (secs: number): number => secs / 60

// Simple string mutations
export const capsFirstLetter = (str: string): string => str.charAt(0).toUpperCase() + str.slice(1)

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
  created?: string,
  lastUpdated?: string,
): boolean => {
  // If no timing data is passed, most likely due to an object not existing
  if (!created && !lastUpdated) {
    return true
  }

  const diffFromCreated = moment().diff(moment(created), "minutes")
  const diffFromNow = moment().diff(moment(lastUpdated), unit)

  // If the db object was created in the last minute, return true.
  if (diffFromCreated <= 1) {
    return true
  }

  // If the db object was updated longer ago than the wait time, return true.
  return diffFromNow >= wait
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

// Create an array of path strings
export const currentPaths = (data: dataType): string[] => {
  let paths: string[] = []

  // If there's no qBittorrent data to check, return
  if (!data.qBittorrent || (!data.qBittorrent.categories && !data.qBittorrent.preferences)) {
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
