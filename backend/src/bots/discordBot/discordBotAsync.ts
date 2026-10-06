import {
  randomEpisodeReadyMessage,
  randomEpisodeStillNotDownloadedMessage,
  randomGrabbedMessage,
  randomGrabNotFoundMessage,
  randomMovieReadyMessage,
  randomMovieStillNotDownloadedMessage,
  randomSeriesReadyMessage,
  randomSeriesStillNotDownloadedMessage,
} from "./discordBotRandomReply"
import { Movie } from "../../types/movieTypes"
import { Message } from "discord.js"
import { settingsDocType } from "../../models/settings"
import {
  discordReply,
  getQueueItemWithLongestTimeLeft,
  sendDiscordMessage,
} from "./discordBotUtility"
import { Series } from "../../types/seriesTypes"
import { getSeriesEpisodes, getSonarrQueue } from "../../shared/SonarrStarrRequests"
import { Episode } from "../../types/episodeTypes"
import { getMovie } from "../../shared/RadarrStarrRequests"
import { QueueNotificationType, waitForWebhooks } from "../../webhooks/webhookUtility"
import logger from "../../logger"

// Asynchronously loop until movie is downloaded. THen notify.
export const notifyMovieDownloaded = async (
  message: Message,
  settings: settingsDocType,
  movie: Movie,
  checkIntervalMs: number = 30_000, // 30 seconds
  timeoutMs: number = 4 * 60 * 60 * 1000, // 4 hours
): Promise<void> => {
  const start = Date.now()

  while (Date.now() - start < timeoutMs) {
    const downloaded = await getMovie(settings, movie.id)

    // Radarr returns the movie whether or not it has a file yet, so only a file means it's ready
    if (downloaded?.hasFile) {
      await sendDiscordMessage(
        message,
        randomMovieReadyMessage(message.author.toString(), movie.title),
      )
      return
    }

    await new Promise((resolve) => setTimeout(resolve, checkIntervalMs))
  }

  await sendDiscordMessage(
    message,
    discordReply(randomMovieStillNotDownloadedMessage(movie.title), "warn"),
  )
}

// Asynchronously loop until we there are no more items in the queue by that series.id. Then notify.
export const notifySeriesDownloaded = async (
  message: Message,
  settings: settingsDocType,
  series: Series,
  checkIntervalMs: number = 30_000, // 30 seconds
  timeoutMs: number = 4 * 60 * 60 * 1000, // 4 hours
): Promise<void> => {
  const start = Date.now()

  // Initial delay to allow queue population
  await new Promise((resolve) => setTimeout(resolve, 5 * 60 * 1000)) // 5 minutes

  while (Date.now() - start < timeoutMs) {
    const queue = (await getSonarrQueue(settings, false)) ?? []
    const seriesEpsInQueue = queue.filter((q) => q.seriesId === series.id)

    if (seriesEpsInQueue.length === 0) {
      await sendDiscordMessage(
        message,
        randomSeriesReadyMessage(message.author.toString(), series.title),
      )
      return
    }

    await new Promise((resolve) => setTimeout(resolve, checkIntervalMs))
  }

  // After the timeout, retrieve the series item in queue with the most time left to download
  const queue = (await getSonarrQueue(settings)) ?? []
  const seriesEpsInQueue = queue.filter((q) => q.seriesId === series.id)
  const longestSeriesEp = getQueueItemWithLongestTimeLeft(seriesEpsInQueue)

  await sendDiscordMessage(
    message,
    discordReply(
      randomSeriesStillNotDownloadedMessage(series.title, longestSeriesEp?.timeleft),
      "warn",
    ),
  )
}

// Asynchronously loop until episode is downloaded. Then notify.
export const notifyEpisodeDownloaded = async (
  message: Message,
  settings: settingsDocType,
  series: Series,
  episode: Episode,
  checkIntervalMs: number = 30_000, // 30 seconds
  timeoutMs: number = 4 * 60 * 60 * 1000, // 4 hours
): Promise<void> => {
  const start = Date.now()

  while (Date.now() - start < timeoutMs) {
    const episodes = await getSeriesEpisodes(settings, series)
    const foundEpisode = episodes.find(
      (e) => e.seasonNumber === episode.seasonNumber && e.episodeNumber === episode.episodeNumber,
    )

    if (!foundEpisode) {
      return
    }

    if (foundEpisode.episodeFile) {
      await sendDiscordMessage(
        message,
        randomEpisodeReadyMessage(message.author.toString(), series.title, episode),
      )
      return
    }

    await new Promise((resolve) => setTimeout(resolve, checkIntervalMs))
  }

  await sendDiscordMessage(
    message,
    discordReply(randomEpisodeStillNotDownloadedMessage(series.title, episode), "warn"),
  )
}

// Notify the requester when released content is grabbed and finishes downloading.
// Uses Starr app webhooks when enabled, otherwise polls the Starr app until the download completes.
export const queueDownloadNotifications = async (
  message: Message,
  settings: settingsDocType,
  content: Movie | Series,
  APIName: "Radarr" | "Sonarr",
  alreadyGrabbed: boolean = false, // Already in the download queue, so only the "ready" notification is wanted
): Promise<void> => {
  if (!settings.webhooks) {
    const notify =
      APIName === "Radarr"
        ? notifyMovieDownloaded(message, settings, content as Movie)
        : notifySeriesDownloaded(message, settings, content as Series)

    notify.catch((err) =>
      logger.error(`queueDownloadNotifications: ${APIName} | Something went wrong: ${err}`),
    )
    return
  }

  const queueNotifications: QueueNotificationType[] = []

  if (settings.webhooks_enabled.includes("Import")) {
    const author = message.author.toString()

    queueNotifications.push({
      waitForStatus: "Import",
      message:
        APIName === "Radarr"
          ? randomMovieReadyMessage(author, content.title)
          : randomSeriesReadyMessage(author, content.title),
      expiry: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours - cleaned up silently if no import
    })
  }

  if (settings.webhooks_enabled.includes("Grab") && !alreadyGrabbed) {
    queueNotifications.push({
      waitForStatus: "Grab",
      message: randomGrabbedMessage(content.title),
      expiry: new Date(Date.now() + 5 * 60 * 1000), // 5 Mins
      expired_message: randomGrabNotFoundMessage(content.title),
    })
  }

  if (queueNotifications.length > 0) {
    await waitForWebhooks(queueNotifications, APIName, ["Discord"], message, null, content)
  }
}
