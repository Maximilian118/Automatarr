import axios from "axios"
import { settingsDocType, settingsType } from "../models/settings"
import { Series } from "../types/seriesTypes"
import { cleanUrl, requestSuccess } from "./utility"
import logger from "../logger"
import { errCodeAndMsg } from "./requestError"
import { DownloadStatus } from "../types/types"
import { Episode, EpisodeFile } from "../types/episodeTypes"
import { HistoryItem } from "../types/historyTypes"

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

// Get series data
export const getSonarrSeries = async (
  settings: settingsDocType,
  seriesID: number,
): Promise<Series | undefined> => {
  try {
    const res = await axios.get(
      cleanUrl(
        `${settings.sonarr_URL}/api/${settings.sonarr_API_version}/series/${seriesID}?apikey=${settings.sonarr_KEY}`,
      ),
    )

    if (requestSuccess(res.status)) {
      return res.data as Series
    } else {
      logger.error(`getSonarrSeries: Could not retrieve Sonarr series with ID ${seriesID}`)
    }
  } catch (err) {
    logger.error(`getSonarrSeries: Sonarr series search error: ${errCodeAndMsg(err)}`)
  }

  return
}

// Get the Sonarr Queue in circumstances where the API object isn't available
export const getSonarrQueue = async (
  settings: settingsDocType,
  logSuccess: boolean = true,
): Promise<DownloadStatus[]> => {
  try {
    const res = await axios.get(
      cleanUrl(
        `${settings.sonarr_URL}/api/${settings.sonarr_API_version}/queue?page=1&pageSize=1000&sortDirection=ascending&sortKey=timeleft&includeUnknownSeriesItems=true&apikey=${settings.sonarr_KEY}`,
      ),
    )

    if (requestSuccess(res.status)) {
      logSuccess && logger.success(`Sonarr | Retrieving Queue.`)

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

// Get history for a specific movie
export const getSeriesHistory = async (
  settings: settingsDocType,
  seriesID: number,
): Promise<HistoryItem[]> => {
  try {
    const res = await axios.get(
      cleanUrl(
        `${settings.sonarr_URL}/api/${settings.sonarr_API_version}/history/series?seriesId=${seriesID}`,
      ),
      {
        headers: {
          "X-Api-Key": settings.sonarr_KEY,
        },
      },
    )

    if (requestSuccess(res.status)) {
      return res.data as HistoryItem[]
    }

    logger.error(
      `getSeriesHistory: Unexpected response from Sonarr. Status: ${res.status} - ${res.statusText}`,
    )
  } catch (err) {
    logger.error(`getSeriesHistory: Sonarr history fetch error: ${errCodeAndMsg(err)}`)
  }

  return []
}

// Get history for a specific movie
export const getEpisodeHistory = async (
  settings: settingsType,
  episodeID: number,
): Promise<HistoryItem[]> => {
  try {
    const res = await axios.get(
      cleanUrl(
        `${settings.sonarr_URL}/api/${settings.sonarr_API_version}/history?pageSize=1000&page=1&sortKey=date&sortDirection=descending&episodeId=${episodeID}`,
      ),
      {
        headers: {
          "X-Api-Key": settings.sonarr_KEY,
        },
      },
    )

    if (requestSuccess(res.status)) {
      return res.data.records as HistoryItem[]
    }

    logger.error(
      `getEpisodeHistory: Unexpected response from Sonarr. Status: ${res.status} - ${res.statusText}`,
    )
  } catch (err) {
    logger.error(`getEpisodeHistory: Sonarr history fetch error: ${errCodeAndMsg(err)}`)
  }

  return []
}

// Get all episodes for a series, optionally with episodeFile details
export const getSeriesEpisodes = async (
  settings: settingsDocType,
  series: Series,
): Promise<Episode[]> => {
  try {
    const res = await axios.get(
      cleanUrl(
        `${settings.sonarr_URL}/api/${settings.sonarr_API_version}/episode?seriesId=${series.id}&apikey=${settings.sonarr_KEY}`,
      ),
    )

    if (!requestSuccess(res.status) || !Array.isArray(res.data)) {
      logger.error(`getSeriesEpisodes: Could not retrieve episodes for series ${series.title}.`)
      return []
    }

    let episodes = res.data as Episode[]

    const episodeFiles = await getSeriesEpisodeFiles(settings, series.id)

    episodes = episodes.map((ep) => {
      const match = episodeFiles.find((file) => file.id === ep.episodeFileId)
      return match ? { ...ep, episodeFile: match } : ep
    })

    return episodes
  } catch (err) {
    logger.error(
      `getSeriesEpisodes: Series episode search error for ${series.title}: ${errCodeAndMsg(err)}`,
    )
    return []
  }
}

// Get EpisodeFiles for a series
export const getSeriesEpisodeFiles = async (
  settings: settingsDocType,
  seriesID: number,
): Promise<EpisodeFile[]> => {
  try {
    const res = await axios.get(
      cleanUrl(
        `${settings.sonarr_URL}/api/${settings.sonarr_API_version}/episodeFile?seriesId=${seriesID}&apikey=${settings.sonarr_KEY}`,
      ),
    )

    if (requestSuccess(res.status)) {
      if (!Array.isArray(res.data)) {
        logger.error(
          `getSeriesEpisodeFiles: Could not retrieve episode files for series ${seriesID}. Response is not an array.`,
        )

        return []
      }

      return res.data as EpisodeFile[]
    } else {
      logger.error(
        `getSeriesEpisodeFiles: Could not retrieve episode files for series ID ${seriesID}.. how peculiar..`,
      )
    }
  } catch (err) {
    logger.error(
      `getSeriesEpisodeFiles: Sonarr episode file search error for ID ${seriesID}: ${errCodeAndMsg(
        err,
      )}`,
    )
  }

  return []
}

// Delete the episode file of a sonarr library item
export const deleteEpisodeFile = async (
  settings: settingsDocType,
  episodeFileID: number,
): Promise<boolean> => {
  try {
    const res = await axios.delete(
      cleanUrl(
        `${settings.sonarr_URL}/api/${settings.sonarr_API_version}/episodeFile/${episodeFileID}`,
      ),
      {
        headers: {
          "X-Api-Key": settings.sonarr_KEY,
        },
      },
    )

    if (requestSuccess(res.status)) {
      return true
    }

    logger.error(
      `deleteEpisodeFile: Unexpected response from Radarr. Status: ${res.status} - ${res.statusText}`,
    )
  } catch (err) {
    logger.error(`deleteEpisodeFile: Radarr delete movieFile error: ${errCodeAndMsg(err)}`)
  }

  return false
}

// Mark a episodeFile as failed. This then automagically triggers a search for a replacement.
export const markEpisodeAsFailed = async (
  settings: settingsType,
  historyItemID: number,
): Promise<boolean> => {
  try {
    const res = await axios.post(
      cleanUrl(
        `${settings.sonarr_URL}/api/${settings.sonarr_API_version}/history/failed/${historyItemID}`,
      ),
      {}, // No payload
      {
        headers: {
          "X-Api-Key": settings.sonarr_KEY,
        },
      },
    )

    if (requestSuccess(res.status)) {
      return true
    }

    logger.error(
      `markEpisodeAsFailed: Unexpected response from Sonarr. Status: ${res.status} - ${res.statusText}`,
    )
  } catch (err) {
    logger.error(`markEpisodeAsFailed: Sonarr history fetch error: ${errCodeAndMsg(err)}`)
  }

  return false
}

// Helper function to blocklist and start the search for another episode
export const blocklistAndSearchEpisode = async (
  settings: settingsType,
  episodeID?: number,
): Promise<HistoryItem | undefined> => {
  if (!episodeID) {
    logger.error(`blocklistAndSearchEpisode: No episodeID passed.`)
    return
  }

  const history = await getEpisodeHistory(settings, episodeID)

  if (history.length === 0) {
    logger.warn(`blocklistAndSearchEpisode: No episode history found for episodeID ${episodeID}`)
    return
  }

  const latestGrabbed = history
    .filter((entry) => entry.eventType === "grabbed")
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0]

  if (await markEpisodeAsFailed(settings, latestGrabbed.id)) {
    logger.success(`Sonarr | ${latestGrabbed.sourceTitle} blocklisted and new search started.`)
    return latestGrabbed
  } else {
    logger.error(
      `blocklistAndSearchEpisode: Failed to mark ${latestGrabbed.sourceTitle} as failed.`,
    )
  }
}
