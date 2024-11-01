import { DownloadStatus, graphqlErr } from "../types/types"
import { APIData } from "./activeAPIsArr"

// Simple calculations
export const minsToSecs = (mins: number): number => mins * 60
export const minsToMillisecs = (mins: number): number => mins * 60000
export const secsToMins = (secs: number): number => secs / 60

// Simple string mutations
export const capsFirstLetter = (str: string): string => str.charAt(0).toUpperCase() + str.slice(1)

// Function to exteact code and message as a string for logger.error
export const errCodeAndMsg = (err: unknown): string => {
  const error = err as graphqlErr
  const res = error.response
  const message = res.data.message ? res.data.message : res.statusText
  return `${res.status} ${message ? message : "Unknown"}`
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
export const findDownloadContentID = (obj: DownloadStatus): number | null => {
  if (obj.movieId !== undefined) return obj.movieId
  if (obj.episodeId !== undefined) return obj.episodeId
  if (obj.albumId !== undefined) return obj.albumId
  return null // No ID found
}
