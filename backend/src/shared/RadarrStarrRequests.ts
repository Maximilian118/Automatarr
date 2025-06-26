import { settingsDocType, settingsType } from "../models/settings"
import { Movie } from "../types/movieTypes"
import { cleanUrl, requestSuccess } from "./utility"
import logger from "../logger"
import axios from "axios"
import { DownloadStatus, SearchCommandResponseType } from "../types/types"
import { HistoryItem } from "../types/historyTypes"
import { axiosErrorMessage } from "./requestError"

// Get the Radarr Queue in circumstances where the API object isn't available
export const getRadarrQueue = async (settings: settingsDocType): Promise<DownloadStatus[]> => {
  try {
    const res = await axios.get(
      cleanUrl(
        `${settings.radarr_URL}/api/${settings.radarr_API_version}/queue?page=1&pageSize=1000&sortDirection=ascending&sortKey=timeleft&includeUnknownMovieItems=true&apikey=${settings.radarr_KEY}`,
      ),
    )

    if (requestSuccess(res.status)) {
      logger.success(`Radarr | Retrieving Queue.`)

      return res.data.records as DownloadStatus[]
    } else {
      logger.error(`getRadarrQueue: Unknown error. Status: ${res.status} - ${res.statusText}`)
    }
  } catch (err) {
    logger.error(`getRadarrQueue: Radarr Error: ${axiosErrorMessage(err)}`)
  }

  return []
}

// Search for movie in tmdb via radarr api
export const searchRadarr = async (
  settings: settingsDocType,
  searchString: string,
): Promise<Movie[] | undefined> => {
  try {
    const res = await axios.get(
      cleanUrl(
        `${settings.radarr_URL}/api/${
          settings.radarr_API_version
        }/movie/lookup?term=${encodeURIComponent(searchString)}&apikey=${settings.radarr_KEY}`,
      ),
    )

    if (requestSuccess(res.status)) {
      return res.data as Movie[]
    } else {
      logger.error(`searchRadarr: Unknown error. Status: ${res.status} - ${res.statusText}`)
    }
  } catch (err) {
    logger.info(`searchRadarr: ${axiosErrorMessage(err)}`)
  }

  return
}

// Download a movie in radarr
export const downloadMovie = async (
  settings: settingsDocType,
  foundMovie: Movie,
  qualityProfileId: number,
  rootFolderPath: string,
): Promise<Movie | undefined> => {
  const formattedMovie = {
    ...foundMovie,
    qualityProfileId,
    monitored: true,
    minimumAvailability: "released",
    addOptions: {
      monitor: "movieOnly",
      searchForMovie: true,
    },
    rootFolderPath,
  }

  try {
    const res = await axios.post(
      cleanUrl(`${settings.radarr_URL}/api/${settings.radarr_API_version}/movie`),
      formattedMovie,
      {
        headers: {
          "Content-Type": "application/json",
          "X-Api-Key": settings.radarr_KEY,
        },
      },
    )

    if (requestSuccess(res.status)) {
      return res.data as Movie
    } else {
      logger.error(`downloadMovie: Unknown error. Status: ${res.status} - ${res.statusText}`)
    }
  } catch (err) {
    logger.info(`downloadMovie: ${axiosErrorMessage(err)}`)
  }

  return
}

// search for a movie that's already added in the Radarr library
export const searchMovieCommand = async (
  settings: settingsDocType,
  foundMovie: Movie,
): Promise<SearchCommandResponseType | undefined> => {
  if (!foundMovie.id) {
    logger.error(`searchMovie: movie.id required.`)
    return
  }

  const searchParams = {
    name: "MoviesSearch",
    movieIds: [foundMovie.id],
  }

  try {
    const res = await axios.post(
      cleanUrl(`${settings.radarr_URL}/api/${settings.radarr_API_version}/command`),
      searchParams,
      {
        headers: {
          "Content-Type": "application/json",
          "X-Api-Key": settings.radarr_KEY,
        },
      },
    )

    if (requestSuccess(res.status)) {
      return res.data as SearchCommandResponseType
    } else {
      logger.error(`downloadMovie: Unknown error. Status: ${res.status} - ${res.statusText}`)
    }
  } catch (err) {
    logger.info(`downloadMovie: ${axiosErrorMessage(err)}`)
  }

  return
}

// A request designed to be as quick as possible to check if a movie has been downloaded
export const getMovie = async (
  settings: settingsDocType,
  movieId: number,
): Promise<Movie | undefined> => {
  if (!movieId) {
    logger.error("getMovie: No movieId passed.")
    return
  }

  try {
    const res = await axios.get(
      cleanUrl(`${settings.radarr_URL}/api/${settings.radarr_API_version}/movie/${movieId}`),
      {
        headers: {
          "X-Api-Key": settings.radarr_KEY,
        },
      },
    )

    if (requestSuccess(res.status)) {
      return res.data as Movie
    }

    logger.error(
      `movieDownloaded: Unexpected response from Radarr. Status: ${res.status} - ${res.statusText}`,
    )
  } catch (err) {
    logger.error(`movieDownloaded: Radarr lookup error: ${axiosErrorMessage(err)}`)
  }

  return
}

// delete the movie file of a radarr library item
export const deleteMovieFile = async (
  settings: settingsType,
  movieFileID: number,
): Promise<boolean> => {
  try {
    const res = await axios.delete(
      cleanUrl(
        `${settings.radarr_URL}/api/${settings.radarr_API_version}/movieFile/${movieFileID}`,
      ),
      {
        headers: {
          "X-Api-Key": settings.radarr_KEY,
        },
      },
    )

    if (requestSuccess(res.status)) {
      return true
    }

    logger.error(
      `deleteMovieFile: Unexpected response from Radarr. Status: ${res.status} - ${res.statusText}`,
    )
  } catch (err) {
    logger.error(`deleteMovieFile: Radarr delete movieFile error: ${axiosErrorMessage(err)}`)
  }

  return false
}

// Get history for a specific movie
export const getMovieHistory = async (
  settings: settingsType,
  movieID: number,
): Promise<HistoryItem[]> => {
  try {
    const res = await axios.get(
      cleanUrl(
        `${settings.radarr_URL}/api/${settings.radarr_API_version}/history/movie?movieId=${movieID}`,
      ),
      {
        headers: {
          "X-Api-Key": settings.radarr_KEY,
        },
      },
    )

    if (requestSuccess(res.status)) {
      return res.data as HistoryItem[]
    }

    logger.error(
      `getMovieHistory: Unexpected response from Radarr. Status: ${res.status} - ${res.statusText}`,
    )
  } catch (err) {
    logger.error(`getMovieHistory: Radarr history fetch error: ${axiosErrorMessage(err)}`)
  }

  return []
}

// Mark a movieFile as failed. This then automagically triggers a search for a replacement.
export const markMovieAsFailed = async (
  settings: settingsType,
  historyItemID: number,
): Promise<boolean> => {
  try {
    const res = await axios.post(
      cleanUrl(
        `${settings.radarr_URL}/api/${settings.radarr_API_version}/history/failed/${historyItemID}`,
      ),
      {}, // No payload
      {
        headers: {
          "X-Api-Key": settings.radarr_KEY,
        },
      },
    )

    if (requestSuccess(res.status)) {
      return true
    }

    logger.error(
      `markMovieAsFailed: Unexpected response from Radarr. Status: ${res.status} - ${res.statusText}`,
    )
  } catch (err) {
    logger.error(`markMovieAsFailed: Radarr history fetch error: ${axiosErrorMessage(err)}`)
  }

  return false
}

// Helper function to blocklist and start the search for another movie
export const blocklistAndSearchMovie = async (
  settings: settingsType,
  movieID?: number,
): Promise<HistoryItem | undefined> => {
  if (!movieID) {
    logger.error(`blocklistAndSearchMovie: No movieID passed.`)
    return
  }

  const history = await getMovieHistory(settings, movieID)

  if (history.length === 0) {
    logger.warn(`blocklistAndSearchMovie: No movie history found for movieID ${movieID}`)
    return
  }

  const latestGrabbed = history
    .filter((entry) => entry.eventType === "grabbed")
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0]

  if (await markMovieAsFailed(settings, latestGrabbed.id)) {
    logger.success(`Radarr | ${latestGrabbed.sourceTitle} blocklisted and new search started.`)
    return latestGrabbed
  } else {
    logger.error(`blocklistAndSearchMovie: Failed to mark ${latestGrabbed.sourceTitle} as failed.`)
  }
}
