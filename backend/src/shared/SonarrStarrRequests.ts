import axios from "axios"
import { settingsDocType } from "../models/settings"
import { Series } from "../types/seriesTypes"
import { cleanUrl, requestSuccess } from "./utility"
import logger from "../logger"
import { errCodeAndMsg } from "./requestError"
import { DownloadStatus } from "../types/types"

// Get sonarr library
export const getSonarrLibrary = async (
  settings: settingsDocType,
): Promise<Series[] | undefined> => {
  try {
    const res = await axios.get(
      cleanUrl(
        `${settings.sonarr_URL}/api/${settings.sonarr_API_version}/series?apikey=${settings.sonarr_KEY}`,
      ),
    )

    if (requestSuccess(res.status)) {
      logger.success(`Sonarr | Retrieving library.`)
      return res.data as Series[]
    } else {
      logger.error(`getSonarrLibrary: Could not retrieve Sonarr library.. how peculiar..`)
    }
  } catch (err) {
    logger.error(`getSonarrLibrary: Sonarr series search error: ${errCodeAndMsg(err)}`)
  }

  return
}

// Get the Sonarr Queue in circumstances where the API object isn't available
export const getSonarrQueue = async (settings: settingsDocType): Promise<DownloadStatus[]> => {
  try {
    const res = await axios.get(
      cleanUrl(
        `${settings.sonarr_URL}/api/${settings.sonarr_API_version}/queue?page=1&pageSize=1000&apikey=${settings.sonarr_KEY}`,
      ),
    )

    if (requestSuccess(res.status)) {
      logger.success(`Sonarr | Retrieving Queue.`)

      return res.data.records as DownloadStatus[]
    } else {
      logger.error(`getSonarrQueue: Unknown error. Status: ${res.status} - ${res.statusText}`)
    }
  } catch (err) {
    logger.error(`getSonarrQueue: Sonarr Error: ${errCodeAndMsg(err)}`)
  }

  return []
}

// Search for series in tmdb via sonarr api
export const searchSonarr = async (
  settings: settingsDocType,
  searchString: string,
): Promise<Series[] | undefined> => {
  try {
    const res = await axios.get(
      cleanUrl(
        `${settings.sonarr_URL}/api/${
          settings.sonarr_API_version
        }/series/lookup?term=${encodeURIComponent(searchString)}&apikey=${settings.sonarr_KEY}`,
      ),
    )

    if (requestSuccess(res.status)) {
      return res.data as Series[]
    } else {
      logger.error(`searchSonarr: Unknown error. Status: ${res.status} - ${res.statusText}`)
    }
  } catch (err) {
    logger.info(`searchSonarr: ${errCodeAndMsg(err)}`)
  }

  return
}

type SonarrMonitorOptions =
  | "all"
  | "future"
  | "missing"
  | "existing"
  | "firstSeason"
  | "lastSeason"
  | "pilot"
  | "recent"
  | "monitorSpecials"
  | "unmonitorSpecials"
  | "none"
  | "skip"

// Download a series in sonarr
export const downloadSeries = async (
  settings: settingsDocType,
  foundSeries: Series,
  qualityProfileId: number,
  rootFolderPath: string,
  monitor: SonarrMonitorOptions = "all",
): Promise<Series | undefined> => {
  const formattedSeries = {
    ...foundSeries,
    qualityProfileId,
    languageProfileId: 1, // default to English
    monitored: true,
    seasonFolder: true,
    monitorNewItems: "all",
    useSceneNumbering: false,
    rootFolderPath,
    addOptions: {
      monitor,
      searchForMissingEpisodes: true,
      searchForCutoffUnmetEpisodes: true,
    },
  }

  try {
    const res = await axios.post(
      cleanUrl(`${settings.sonarr_URL}/api/${settings.sonarr_API_version}/series`),
      formattedSeries,
      {
        headers: {
          "Content-Type": "application/json",
          "X-Api-Key": settings.sonarr_KEY,
        },
      },
    )

    if (requestSuccess(res.status)) {
      return res.data as Series
    } else {
      logger.error(`downloadSeries: Unknown error. Status: ${res.status} - ${res.statusText}`)
    }
  } catch (err) {
    logger.info(`downloadSeries: ${errCodeAndMsg(err)}`)
  }

  return
}
