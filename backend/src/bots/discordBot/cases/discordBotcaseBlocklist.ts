import { Message } from "discord.js"
import Settings, { settingsDocType } from "../../../models/settings"
import { discordReply, matchedDiscordUser, matchedUser, noDBPull } from "../discordBotUtility"
import { validateBlocklistCommand } from "../validate/validateBlocklistCommand"
import {
  randomMovieReplacementMessage,
  randomEpisodeReplacementMessage,
  randomMovieReadyMessage,
  randomSeriesReadyMessage,
  randomGrabbedMessage,
  randomGrabNotFoundMessage,
} from "../discordBotRandomReply"
import Data, { dataDocType } from "../../../models/data"
import {
  deleteMovieFile,
  getMovieHistory,
  markMovieAsFailed,
} from "../../../shared/RadarrStarrRequests"
import {
  deleteEpisodeFile,
  getEpisodeHistory,
  getSeriesEpisodes,
  markEpisodeAsFailed,
} from "../../../shared/SonarrStarrRequests"
import logger from "../../../logger"
import { notifyEpisodeDownloaded, notifyMovieDownloaded } from "../discordBotAsync"
import { QueueNotificationType, waitForWebhooks } from "../../../webhooks/webhookUtility"

// Mark a download as unsatisfactory, blocklist it and add start a new download
// NO ADMIN PERMISSIONS NEEDED BUT WE'RE REMOVING FILES SO AT LEAST RATE LIMIT
export const caseBlocklist = async (message: Message): Promise<string> => {
  const settings = (await Settings.findOne()) as settingsDocType
  if (!settings) return noDBPull()

  // Retrieve Data Object for database comparison. Not going to request the entire Starr app library to compare with. Too expensive.
  const data = (await Data.findOne()) as dataDocType

  if (!data) {
    return discordReply(
      "Hmm.. I couldn't connect to the databse... this is very bad.",
      "catastrophic",
    )
  }

  // Validate the request string: `!blocklist <movieTitleYear/seriesTitleS01E01>`
  const parsed = await validateBlocklistCommand(message, settings, data)
  if (typeof parsed === "string") return parsed

  const {
    contentType,
    title,
    year,
    seasonNumber,
    episodeNumber,
    noMatchMessage,
    movieDBList,
    seriesDBList,
  } = parsed

  // Get guildMember while checking if <discord_username> exists on the server
  const guildMember = await matchedDiscordUser(message, message.author.username)
  if (!guildMember) return `The user \`${message.author.username}\` does not exist in this server.`
  const username = guildMember.user.username

  // Get user while checking if user exists in the database
  const user = matchedUser(settings, username)
  if (!user) return `A Discord user by <@${guildMember.id}> does not exist in the database.`

  // If we've targeted a movie, delete the movieFile and then mark the download as failed in queue history
  if (contentType === "movie") {
    const movieInDB = movieDBList.find((m) => {
      const yearMatch = m.secondaryYear === year || m.year === year
      return m.title.toLowerCase() === title.toLowerCase() && yearMatch
    })

    if (!movieInDB) {
      return noMatchMessage
    }

    if (!movieInDB.movieFile) {
      return `Hmm.. the movie ${title} doesn't look like it's been downloaded yet. Are you sure you have the right movie?`
    }

    const history = await getMovieHistory(settings, movieInDB.id)
    const latestGrabbed = history
      .filter((entry) => entry.eventType === "grabbed")
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0]

    if (!(await deleteMovieFile(settings, movieInDB.movieFile.id))) {
      return "Forgive me. I was unable to delete the movie file. Please send your wax sealed complaint scroll to the server owner via Owl and we'll get back to you within 20 moons."
    }

    if (!(await markMovieAsFailed(settings, latestGrabbed.id))) {
      return `I've been able to delete the file for ${title} but I couldn't start another download. If you'd like to watch the movie now you might want to give an admin a poke!`
    }

    if (settings.webhooks) {
      const queueNotifications: QueueNotificationType[] = []

      if (settings.webhooks_enabled.includes("Import")) {
        queueNotifications.push({
          waitForStatus: "Import",
          message: randomMovieReadyMessage(message.author.toString(), movieInDB.title),
        })
      }

      if (settings.webhooks_enabled.includes("Grab")) {
        queueNotifications.push({
          waitForStatus: "Grab",
          message: randomGrabbedMessage(movieInDB.title),
          expiry: new Date(Date.now() + 5 * 60 * 1000),
          expired_message: randomGrabNotFoundMessage(movieInDB.title),
        })
      }

      if (queueNotifications.length > 0) {
        await waitForWebhooks(queueNotifications, "Radarr", ["Discord"], message, null, movieInDB)
      }
    } else {
      // Start an asynchronous loop waiting for the movie to finish downloading. Then send a notification.
      notifyMovieDownloaded(message, settings, movieInDB).catch((err) =>
        logger.error(`notifyMovieDownloaded: Something went wrong: ${err}`),
      )
    }

    return randomMovieReplacementMessage(title)
  } else {
    const titleLower = title.toLowerCase()
    const seriesInDB = seriesDBList.find(
      (s) =>
        s.title.toLowerCase() === titleLower ||
        s.alternateTitles.some((t) => t.title.toLowerCase() === titleLower) ||
        s.sortTitle.toLowerCase() === titleLower ||
        s.path.toLowerCase().includes(titleLower),
    )

    if (!seriesInDB) {
      return noMatchMessage
    }

    // Find the correct season and episode in the series
    const episodes = await getSeriesEpisodes(settings, seriesInDB)
    const episode = episodes.find(
      (e) => e.seasonNumber === seasonNumber && e.episodeNumber === episodeNumber,
    )

    if (!episode) {
      const seasonInDB = seriesInDB.seasons.find((s) => s.seasonNumber === seasonNumber)

      if (!seasonInDB) {
        return `The series ${title} doesn't have a season ${seasonNumber}. Please check the season number.`
      }

      const totalEpisodes = seasonInDB.statistics?.episodeCount ?? 0
      return `Season ${seasonNumber} of ${title} only has ${totalEpisodes} episode${
        totalEpisodes === 1 ? "" : "s"
      }, but you've targeted episode ${episodeNumber}. Please check the episode number.`
    }

    if (!episode.episodeFile) {
      return `Hmm.. Season ${episode.seasonNumber} Episode ${episode.episodeNumber} ${episode.title} for the series ${title} doesn't look like it's been downloaded yet. Are you sure you have the right episode?`
    }

    const history = await getEpisodeHistory(settings, episode.id)
    const latestGrabbed = history
      .filter((entry) => entry.eventType === "grabbed")
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0]

    if (!(await deleteEpisodeFile(settings, episode.episodeFile.id))) {
      return "Forgive me. I was unable to delete the episode file. Please inform the server emperor at once!"
    }

    if (!(await markEpisodeAsFailed(settings, latestGrabbed.id))) {
      return `I've been able to delete the file for ${title} season ${episode.seasonNumber} episode ${episode.episodeNumber} but I couldn't start another download. If you'd like to watch the episode now you might want to give an admin a poke!`
    }

    if (settings.webhooks) {
      const queueNotifications: QueueNotificationType[] = []

      if (settings.webhooks_enabled.includes("Import")) {
        queueNotifications.push({
          waitForStatus: "Import",
          message: randomSeriesReadyMessage(message.author.toString(), seriesInDB.title),
          expiry: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours - cleaned up silently if no import
        })
      }

      if (settings.webhooks_enabled.includes("Grab")) {
        queueNotifications.push({
          waitForStatus: "Grab",
          message: randomGrabbedMessage(seriesInDB.title),
          expiry: new Date(Date.now() + 5 * 60 * 1000), // 5 mins
          expired_message: randomGrabNotFoundMessage(seriesInDB.title),
        })
      }

      if (queueNotifications.length > 0) {
        await waitForWebhooks(queueNotifications, "Sonarr", ["Discord"], message, null, seriesInDB)
      }
    } else {
      // Start an asynchronous loop waiting for the episode to finish downloading. Then send a notification.
      notifyEpisodeDownloaded(message, settings, seriesInDB, episode).catch((err) =>
        logger.error(`notifyEpisodeDownloaded: Something went wrong: ${err}`),
      )
    }

    return randomEpisodeReplacementMessage(title, episode.seasonNumber, episode.episodeNumber)
  }
}
