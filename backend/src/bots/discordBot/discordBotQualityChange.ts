import { Message } from "discord.js"
import { settingsDocType } from "../../models/settings"
import { dataDocType } from "../../models/data"
import { Movie } from "../../types/movieTypes"
import { Series } from "../../types/seriesTypes"
import { DownloadStatus } from "../../types/types"
import { settingsToAPIData } from "../../shared/activeAPIsArr"
import { deleteFromQueue } from "../../shared/StarrRequests"
import { searchMovieCommand, updateMovieQualityProfile } from "../../shared/RadarrStarrRequests"
import {
  getSonarrQueue,
  searchMonitoredSeries,
  updateSeriesQualityProfile,
} from "../../shared/SonarrStarrRequests"
import logger from "../../logger"
import {
  discordReply,
  findQualityProfileByAlias,
  getQualityGroup,
  getQueueItemWithLongestTimeLeft,
  resolutionToQualityGroup,
} from "./discordBotUtility"
import {
  randomAlreadyDownloadedInQualityMessage,
  randomAlreadyDownloadingInQualityMessage,
  randomDownloadFinishingMessage,
  randomMovieQualityDownloadStartMessage,
  randomQualityChangeMessage,
  randomSeriesQualityDownloadStartMessage,
} from "./discordBotRandomReply"
import { queueDownloadNotifications } from "./discordBotAsync"

// Everything needed to apply a quality change to a movie or series in a Starr app
type QualityChangeTarget = {
  APIName: "Radarr" | "Sonarr"
  content: Movie | Series
  queueItems: DownloadStatus[] // Queue items that belong to the content
  updateProfile: (qualityProfileId: number) => Promise<boolean>
  search: () => Promise<boolean>
  noQueueReply: (qualityArg: string) => string // Reply when nothing is in the queue for the content
}

// Get the quality group (e.g. "4k") a queue item is downloading in
const queueItemQualityGroup = (queueItem: DownloadStatus): string | undefined =>
  resolutionToQualityGroup(queueItem.quality?.quality?.resolution)

// Apply a user's quality argument to content that's already in a Starr app library.
// - Items already downloading in the requested quality are left alone and the time left is returned.
// - Items downloading in a different quality are removed from the download client, the quality
//   profile is changed and a new search is started.
// - Items that have finished downloading and are importing can't be switched.
const applyQualityChange = async (
  message: Message,
  settings: settingsDocType,
  data: dataDocType,
  target: QualityChangeTarget,
  qualityArg: string,
): Promise<string> => {
  const { APIName, content, queueItems } = target
  const requestedGroup = getQualityGroup(qualityArg)

  const requestedProfile = findQualityProfileByAlias(qualityArg, data, APIName)
  if (typeof requestedProfile === "string") return discordReply(requestedProfile, "info")

  // Keep the profile in line with the user's request so later upgrades respect it
  const syncProfile = async (): Promise<boolean> =>
    content.qualityProfileId === requestedProfile.id ||
    (await target.updateProfile(requestedProfile.id))

  // Nothing downloading yet. Switch the profile and search with the new one.
  if (queueItems.length === 0) {
    if (!(await syncProfile())) {
      return discordReply(
        `I couldn't change the quality of '${content.title}'. Please poke an admin!`,
        "error",
      )
    }

    await target.search()
    await queueDownloadNotifications(message, settings, content, APIName)
    return target.noQueueReply(qualityArg)
  }

  // Items with nothing left to download are being imported and can't be switched
  const downloadingItems = queueItems.filter((q) => q.sizeleft > 0)

  if (downloadingItems.length === 0) {
    return randomDownloadFinishingMessage(content.title, queueItemQualityGroup(queueItems[0]))
  }

  const mismatchedItems = downloadingItems.filter((q) => queueItemQualityGroup(q) !== requestedGroup)

  // Already downloading in the requested quality
  if (mismatchedItems.length === 0) {
    await syncProfile()
    const longest = getQueueItemWithLongestTimeLeft(downloadingItems)
    return randomAlreadyDownloadingInQualityMessage(content.title, qualityArg, longest?.timeleft)
  }

  // Cancel the downloads in the wrong quality. They're removed from the download client as the
  // user no longer wants them. They aren't blocklisted as the release itself isn't bad.
  const API = settingsToAPIData(settings, APIName)
  const previousGroup = queueItemQualityGroup(mismatchedItems[0])

  for (const queueItem of mismatchedItems) {
    const removed = await deleteFromQueue(queueItem, API, `| Quality change to ${qualityArg}.`, {
      removeFromClient: true,
    })

    if (!removed) {
      return discordReply(
        `I couldn't cancel the current download of '${content.title}'. Please poke an admin!`,
        "error",
      )
    }
  }

  if (!(await syncProfile())) {
    return discordReply(
      `I cancelled the old download of '${content.title}' but couldn't change its quality. Please poke an admin!`,
      "error",
    )
  }

  if (!(await target.search())) {
    logger.error(`${APIName} | ${content.title} | Quality changed but the new search failed.`)
  }

  await queueDownloadNotifications(message, settings, content, APIName)

  return discordReply(
    randomQualityChangeMessage(content.title, previousGroup, qualityArg),
    "success",
    `${message.author.username} | Quality Change | ${content.title} | ${previousGroup ?? "unknown"} -> ${qualityArg}`,
  )
}

// Handle a !download of a movie in the library with a quality argument.
// `queueItems` are the movie's items in the Radarr download queue.
export const handleMovieQualityChange = async (
  message: Message,
  settings: settingsDocType,
  data: dataDocType,
  movie: Movie,
  queueItems: DownloadStatus[],
  qualityArg: string,
): Promise<string> =>
  applyQualityChange(
    message,
    settings,
    data,
    {
      APIName: "Radarr",
      content: movie,
      queueItems,
      updateProfile: (qualityProfileId) =>
        updateMovieQualityProfile(settings, [movie.id], qualityProfileId),
      search: async () => !!(await searchMovieCommand(settings, movie)),
      noQueueReply: (quality) => randomMovieQualityDownloadStartMessage(movie, quality),
    },
    qualityArg,
  )

// Handle a !download of a series in the library with a quality argument
export const handleSeriesQualityChange = async (
  message: Message,
  settings: settingsDocType,
  data: dataDocType,
  series: Series,
  qualityArg: string,
): Promise<string> => {
  // Fully downloaded content is left as is
  if (series.statistics?.percentOfEpisodes === 100) {
    return randomAlreadyDownloadedInQualityMessage(series.title)
  }

  const queueItems = (await getSonarrQueue(settings)).filter((q) => q.seriesId === series.id)

  return applyQualityChange(
    message,
    settings,
    data,
    {
      APIName: "Sonarr",
      content: series,
      queueItems,
      updateProfile: (qualityProfileId) =>
        updateSeriesQualityProfile(settings, [series.id], qualityProfileId),
      search: () => searchMonitoredSeries(settings, series.id),
      noQueueReply: (quality) => randomSeriesQualityDownloadStartMessage(series, quality),
    },
    qualityArg,
  )
}
