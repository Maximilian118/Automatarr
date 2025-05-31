import { settingsDocType } from "../models/settings"
import { Movie } from "../types/movieTypes"
import { cleanUrl, requestSuccess } from "./utility"
import logger from "../logger"
import { errCodeAndMsg } from "./requestError"
import axios from "axios"
import { DownloadStatus } from "../types/types"

// Get the Radarr Queue in circumstances where the API object isn't available
export const getRadarrQueue = async (settings: settingsDocType): Promise<DownloadStatus[]> => {
  try {
    const res = await axios.get(
      cleanUrl(
        `${settings.radarr_URL}/api/${settings.radarr_API_version}/queue?page=1&pageSize=1000&apikey=${settings.radarr_KEY}`,
      ),
    )

    if (requestSuccess(res.status)) {
      logger.success(`Radarr | Retrieving Queue.`)

      return res.data.records as DownloadStatus[]
    } else {
      logger.error(`getRadarrQueue: Unknown error. Status: ${res.status} - ${res.statusText}`)
    }
  } catch (err) {
    logger.error(`getRadarrQueue: Radarr Error: ${errCodeAndMsg(err)}`)
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
    logger.info(`searchRadarr: ${errCodeAndMsg(err)}`)
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
    logger.info(`downloadMovie: ${errCodeAndMsg(err)}`)
  }

  return
}

// A request designed to be as quick as possible to check if a movie has been downloaded
export const movieDownloaded = async (
  settings: settingsDocType,
  movieId: number,
): Promise<boolean> => {
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
      return res.data?.hasFile === true
    }

    logger.error(
      `movieDownloaded: Unexpected response from Radarr. Status: ${res.status} - ${res.statusText}`,
    )
  } catch (err) {
    logger.error(`movieDownloaded: Radarr lookup error: ${errCodeAndMsg(err)}`)
  }

  return false
}
