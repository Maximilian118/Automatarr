import { movieDownloaded } from "../../shared/RadarrStarrRequests"
import {
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
import { getSonarrQueue } from "../../shared/SonarrStarrRequests"

// Asynchronously loop until movie is downloaded. THen notify.
export const notifyMovieDownloaded = async (
  message: Message,
  settings: settingsDocType,
  movie: Movie,
  checkIntervalMs: number = 30_000, // 30 seconds
  timeoutMs: number = 4 * 60 * 60 * 1000, // 4 hours in ms
): Promise<void> => {
  const start = Date.now()

  while (Date.now() - start < timeoutMs) {
    const downloaded = await movieDownloaded(settings, movie.id)

    if (downloaded) {
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
    const queue = (await getSonarrQueue(settings)) ?? []
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
