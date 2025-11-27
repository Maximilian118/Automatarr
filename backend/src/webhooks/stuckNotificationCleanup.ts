import { Collection, Message, TextChannel } from "discord.js"
import Settings, { settingsDocType } from "../models/settings"
import logger from "../logger"
import { getDiscordClient } from "../bots/discordBot/discordBot"
import { getMovie } from "../shared/RadarrStarrRequests"
import { getSonarrSeries } from "../shared/SonarrStarrRequests"
import { sendDiscordNotification } from "../bots/discordBot/discordBotUtility"
import { WebHookWaitingType } from "../models/webhook"
import { Movie } from "../types/movieTypes"
import { Series } from "../types/seriesTypes"
import {
  randomMovieReadyMessage,
  randomSeriesReadyMessage,
  randomGrabNotFoundMessage,
} from "../bots/discordBot/discordBotRandomReply"

// Grace periods in milliseconds
const MOVIE_GRACE_PERIOD = 15 * 60 * 1000 // 15 minutes
const SERIES_GRACE_PERIOD = 2 * 60 * 60 * 1000 // 2 hours

// "Not Found" grace periods - how long to wait before marking as missing
const MOVIE_NOT_FOUND_PERIOD = 8 * 60 * 60 * 1000 // 8 hours
const SERIES_NOT_FOUND_PERIOD = 24 * 60 * 60 * 1000 // 24 hours

// Check if a Discord message is a "downloading" webhook notification
const isDownloadingNotification = (message: Message): boolean => {
  // Check if message has embeds
  if (!message.embeds || message.embeds.length === 0) {
    return false
  }

  const embed = message.embeds[0]

  // Check if the embed color matches "downloading" status (orange: 0xff8c00)
  if (embed.color !== 0xff8c00) {
    return false
  }

  // Check if the description contains "Downloading"
  const description = embed.description
  if (!description || !description.includes("Downloading")) {
    return false
  }

  return true
}

// Extract content title and year from Discord embed
const extractContentInfo = (
  message: Message,
): { title: string; year: number | null; type: "movie" | "series" | null } => {
  if (!message.embeds || message.embeds.length === 0) {
    return { title: "", year: null, type: null }
  }

  const embed = message.embeds[0]
  const description = embed.description

  if (!description) {
    return { title: "", year: null, type: null }
  }

  // Extract title and year from format: "**Status**\n\n**Title (Year)**\nMessage"
  const titleMatch = description.match(/\*\*([^*]+?)\s*\((\d{4})\)\*\*/i)

  if (titleMatch) {
    const title = titleMatch[1].trim()
    const year = parseInt(titleMatch[2], 10)

    // Determine type based on embed fields
    const hasSeasons = embed.fields?.some((field) => field.name === "Seasons")
    const type = hasSeasons ? "series" : "movie"

    return { title, year, type }
  }

  return { title: "", year: null, type: null }
}

// Get movie data from Radarr API and return with download status
const getMovieWithStatus = async (
  settings: settingsDocType,
  title: string,
  year: number | null,
): Promise<{ movie: Movie; hasFile: boolean } | null> => {
  try {
    // Search for the movie by title
    const { searchRadarr } = await import("../shared/RadarrStarrRequests")
    const searchResults = await searchRadarr(settings, title)

    if (!searchResults || searchResults.length === 0) {
      return null
    }

    // Find movie matching both title and year if provided
    const matchedMovie = searchResults.find((movie) => {
      const titleMatch = movie.title.toLowerCase() === title.toLowerCase()
      const yearMatch = year ? movie.year === year : true
      return titleMatch && yearMatch
    })

    if (!matchedMovie || !matchedMovie.id) {
      return null
    }

    // Get the full movie data including hasFile status
    const fullMovie = await getMovie(settings, matchedMovie.id)

    if (!fullMovie) {
      return null
    }

    // Return the full movie object with download status
    return { movie: fullMovie, hasFile: fullMovie.hasFile || false }
  } catch (err) {
    logger.error(
      `stuckNotificationCleanup | getMovieWithStatus | Error checking movie ${title}: ${String(err)}`,
    )
    return null
  }
}

// Get series data from Sonarr API and return with download status
const getSeriesWithStatus = async (
  settings: settingsDocType,
  title: string,
  year: number | null,
): Promise<{ series: Series; isComplete: boolean } | null> => {
  try {
    // Search for the series by title
    const { searchSonarr } = await import("../shared/SonarrStarrRequests")
    const searchResults = await searchSonarr(settings, title)

    if (!searchResults || searchResults.length === 0) {
      return null
    }

    // Find series matching both title and year if provided
    const matchedSeries = searchResults.find((series) => {
      const titleMatch = series.title.toLowerCase() === title.toLowerCase()
      let yearMatch = true

      if (year && series.firstAired) {
        const firstAiredYear = new Date(series.firstAired).getFullYear()
        yearMatch = firstAiredYear === year
      }

      return titleMatch && yearMatch
    })

    if (!matchedSeries || !matchedSeries.id) {
      return null
    }

    // Get the full series data including statistics
    const fullSeries = await getSonarrSeries(settings, matchedSeries.id)

    if (!fullSeries) {
      return null
    }

    // Check if all episodes have been downloaded
    const isComplete = fullSeries.statistics?.percentOfEpisodes === 100

    // Return the full series object with download status
    return { series: fullSeries, isComplete }
  } catch (err) {
    logger.error(
      `stuckNotificationCleanup | getSeriesWithStatus | Error checking series ${title}: ${String(err)}`,
    )
    return null
  }
}

// Fetch messages from a Discord channel
const fetchChannelMessages = async (
  channel: TextChannel,
  limit: number = 100,
): Promise<Collection<string, Message>> => {
  try {
    return await channel.messages.fetch({ limit })
  } catch (err) {
    logger.error(
      `stuckNotificationCleanup | fetchChannelMessages | Error fetching messages from ${channel.name}: ${String(err)}`,
    )
    return new Collection()
  }
}

// Main cleanup function to check for stuck "downloading" notifications
export const cleanupStuckNotifications = async (): Promise<void> => {
  try {
    const settings = (await Settings.findOne()) as settingsDocType

    if (!settings) {
      logger.error("stuckNotificationCleanup | No settings found in database")
      return
    }

    const client = getDiscordClient()

    if (!client) {
      logger.warn("stuckNotificationCleanup | Discord client not available")
      return
    }

    const movieChannelName = settings.discord_bot.movie_channel_name
    const seriesChannelName = settings.discord_bot.series_channel_name

    // Find the movie and series channels
    const movieChannel = client.channels.cache.find(
      (ch): ch is TextChannel =>
        ch.isTextBased() && "name" in ch && ch.name === movieChannelName,
    )

    const seriesChannel = client.channels.cache.find(
      (ch): ch is TextChannel =>
        ch.isTextBased() && "name" in ch && ch.name === seriesChannelName,
    )

    const now = Date.now()

    // Check movie channel for stuck notifications
    if (movieChannel) {
      const messages = await fetchChannelMessages(movieChannel)

      for (const [, message] of messages) {
        // Skip messages not from the bot
        if (message.author.id !== client.user?.id) {
          continue
        }

        // Check if this is a "downloading" notification
        if (!isDownloadingNotification(message)) {
          continue
        }

        // Check if message is old enough (grace period)
        const messageAge = now - message.createdTimestamp
        if (messageAge < MOVIE_GRACE_PERIOD) {
          continue
        }

        // Extract content info from the message
        const { title, year, type } = extractContentInfo(message)

        if (!title || type !== "movie") {
          continue
        }

        // Check if the movie has been downloaded
        const movieData = await getMovieWithStatus(settings, title, year)

        if (!movieData) {
          // Movie not found in Radarr - skip
          continue
        }

        if (movieData.hasFile) {
          // Movie is downloaded but notification is still showing "downloading"
          logger.warn(
            `stuckNotificationCleanup | Found stuck "Downloading" notification for movie "${title}" (${year}) in channel "${movieChannelName}". Movie has been downloaded for ${Math.floor(messageAge / 60000)} minutes. Sending "Ready" notification now.`,
          )

          // Create a webhook notification object to send the "Ready" message
          const webhookNotification: WebHookWaitingType = {
            APIName: "Radarr",
            bots: ["Discord"],
            discordData: {
              guildId: message.guild?.id ?? "",
              channelId: message.channel.id,
              authorId: message.author.id,
              authorUsername: message.author.username,
              authorMention: message.author.toString(),
              messageId: message.id,
            },
            whatsappData: null,
            content: movieData.movie,
            seasons: [],
            episodes: [],
            waitForStatus: "Import",
            status: "ready",
            message: randomMovieReadyMessage(
              message.author.toString(),
              movieData.movie.title,
            ),
            sentMessageId: message.id, // This will edit the existing message
            created_at: new Date(),
          }

          // Send the "Ready" notification (will edit the existing message)
          await sendDiscordNotification(webhookNotification)
        } else if (messageAge >= MOVIE_NOT_FOUND_PERIOD) {
          // Movie not downloaded and grace period exceeded - mark as "Not Found"
          logger.warn(
            `stuckNotificationCleanup | Found stuck "Downloading" notification for movie "${title}" (${year}) in channel "${movieChannelName}". Movie has not been downloaded after ${Math.floor(messageAge / 60000)} minutes. Marking as "Not Found".`,
          )

          // Create a webhook notification object to send the "Not Found" message
          const webhookNotification: WebHookWaitingType = {
            APIName: "Radarr",
            bots: ["Discord"],
            discordData: {
              guildId: message.guild?.id ?? "",
              channelId: message.channel.id,
              authorId: message.author.id,
              authorUsername: message.author.username,
              authorMention: message.author.toString(),
              messageId: message.id,
            },
            whatsappData: null,
            content: movieData.movie,
            seasons: [],
            episodes: [],
            waitForStatus: "Grab",
            status: "not_found",
            message: randomGrabNotFoundMessage(title),
            expired_message: randomGrabNotFoundMessage(title),
            sentMessageId: message.id, // This will edit the existing message
            created_at: new Date(),
          }

          // Send the "Not Found" notification with expired flag (will edit the existing message)
          await sendDiscordNotification(webhookNotification, true)
        }
        // If downloadedMovie is null and messageAge < MOVIE_NOT_FOUND_PERIOD, skip (still downloading)
      }
    }

    // Check series channel for stuck notifications
    if (seriesChannel) {
      const messages = await fetchChannelMessages(seriesChannel)

      for (const [, message] of messages) {
        // Skip messages not from the bot
        if (message.author.id !== client.user?.id) {
          continue
        }

        // Check if this is a "downloading" notification
        if (!isDownloadingNotification(message)) {
          continue
        }

        // Check if message is old enough (grace period)
        const messageAge = now - message.createdTimestamp
        if (messageAge < SERIES_GRACE_PERIOD) {
          continue
        }

        // Extract content info from the message
        const { title, year, type } = extractContentInfo(message)

        if (!title || type !== "series") {
          continue
        }

        // Check if the series has been downloaded
        const seriesData = await getSeriesWithStatus(settings, title, year)

        if (!seriesData) {
          // Series not found in Sonarr - skip
          continue
        }

        if (seriesData.isComplete) {
          // Series is downloaded but notification is still showing "downloading"
          logger.warn(
            `stuckNotificationCleanup | Found stuck "Downloading" notification for series "${title}" (${year}) in channel "${seriesChannelName}". Series has been downloaded for ${Math.floor(messageAge / 60000)} minutes. Sending "Ready" notification now.`,
          )

          // Create a webhook notification object to send the "Ready" message
          const webhookNotification: WebHookWaitingType = {
            APIName: "Sonarr",
            bots: ["Discord"],
            discordData: {
              guildId: message.guild?.id ?? "",
              channelId: message.channel.id,
              authorId: message.author.id,
              authorUsername: message.author.username,
              authorMention: message.author.toString(),
              messageId: message.id,
            },
            whatsappData: null,
            content: seriesData.series,
            seasons: [],
            episodes: [],
            waitForStatus: "Import",
            status: "ready",
            message: randomSeriesReadyMessage(
              message.author.toString(),
              seriesData.series.title,
            ),
            sentMessageId: message.id, // This will edit the existing message
            created_at: new Date(),
          }

          // Send the "Ready" notification (will edit the existing message)
          await sendDiscordNotification(webhookNotification)
        } else if (messageAge >= SERIES_NOT_FOUND_PERIOD) {
          // Series not downloaded and grace period exceeded - mark as "Not Found"
          logger.warn(
            `stuckNotificationCleanup | Found stuck "Downloading" notification for series "${title}" (${year}) in channel "${seriesChannelName}". Series has not been downloaded after ${Math.floor(messageAge / 60000)} minutes. Marking as "Not Found".`,
          )

          // Create a webhook notification object to send the "Not Found" message
          const webhookNotification: WebHookWaitingType = {
            APIName: "Sonarr",
            bots: ["Discord"],
            discordData: {
              guildId: message.guild?.id ?? "",
              channelId: message.channel.id,
              authorId: message.author.id,
              authorUsername: message.author.username,
              authorMention: message.author.toString(),
              messageId: message.id,
            },
            whatsappData: null,
            content: seriesData.series,
            seasons: [],
            episodes: [],
            waitForStatus: "Grab",
            status: "not_found",
            message: randomGrabNotFoundMessage(title),
            expired_message: randomGrabNotFoundMessage(title),
            sentMessageId: message.id, // This will edit the existing message
            created_at: new Date(),
          }

          // Send the "Not Found" notification with expired flag (will edit the existing message)
          await sendDiscordNotification(webhookNotification, true)
        }
        // If downloadedSeries is null and messageAge < SERIES_NOT_FOUND_PERIOD, skip (still downloading)
      }
    }
  } catch (err) {
    logger.error(`stuckNotificationCleanup | Error during cleanup: ${String(err)}`)
  }
}

let cleanupIntervalStarted = false

// Start the stuck notification cleanup interval
export const startStuckNotificationCleanup = (): void => {
  if (cleanupIntervalStarted) return

  cleanupIntervalStarted = true

  // Run immediately on startup
  setTimeout(() => {
    cleanupStuckNotifications().catch((err) => {
      logger.error(`stuckNotificationCleanup | Startup cleanup error: ${String(err)}`)
    })
  }, 5000) // Wait 5 seconds after startup to ensure Discord bot is ready

  // Run every 15 minutes
  setInterval(
    async () => {
      try {
        await cleanupStuckNotifications()
      } catch (err) {
        logger.error(`stuckNotificationCleanup | Interval cleanup error: ${String(err)}`)
      }
    },
    15 * 60 * 1000,
  ) // 15 minutes

  logger.info("stuckNotificationCleanup | Started stuck notification cleanup watcher (15 min interval)")
}
