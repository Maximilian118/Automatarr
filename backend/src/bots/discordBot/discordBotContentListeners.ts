import { Message } from "discord.js"
import Settings, { settingsDocType } from "../../models/settings"
import {
  discordReply,
  findQualityProfile,
  findQualityProfileByAlias,
  findRootFolder,
  freeSpaceCheck,
  matchedUser,
  noDBPull,
  noDBSave,
  sendDiscordMessage,
} from "./discordBotUtility"
import { validateDownload } from "./validate/validateDownload"
import { checkUserMovieLimit, checkUserSeriesLimit } from "./discordBotUserLimits"
import {
  randomNotFoundMessage,
  randomAlreadyAddedMessage,
  getMovieStatusMessage,
  randomEpisodesDownloadingMessage,
  randomMovieDownloadStartMessage,
  randomMovieQualityDownloadStartMessage,
  randomSeriesDownloadStartMessage,
  randomSeriesMonitorDownloadStartMessage,
  randomSeriesQualityDownloadStartMessage,
  randomSeriesQualityMonitorDownloadStartMessage,
  randomSeriesMonitorChangeToAllMessage,
  randomProcessingMessage,
  randomMovieReadyMessage,
  randomSeriesReadyMessage,
  randomGrabbedMessage,
  randomGrabNotFoundMessage,
  randomReAddedToPoolMessage,
  randomUnreleasedAddedMessage,
  randomUnreleasedMovieReadyMessage,
  randomUnreleasedSeriesReadyMessage,
} from "./discordBotRandomReply"
import Data, { dataDocType } from "../../models/data"
import { saveWithRetry } from "../../shared/database"
import {
  downloadMovie,
  getMovie,
  getRadarrQueue,
  searchMovieCommand,
  searchRadarr,
} from "../../shared/RadarrStarrRequests"
import {
  downloadSeries,
  getSonarrLibrary,
  getSonarrQueue,
  searchSonarr,
  updateSeriesMonitor,
  searchMonitoredSeries,
} from "../../shared/SonarrStarrRequests"
import logger from "../../logger"
import { notifyMovieDownloaded, notifySeriesDownloaded } from "./discordBotAsync"
import { isSeriesReleased, sortTMDBSearchArray } from "../botUtility"
import { Movie } from "../../types/movieTypes"
import { QualityProfile } from "../../types/qualityProfileType"
import { Series } from "../../types/seriesTypes"
import { channelValid } from "./validate/validationUtility"
import { QueueNotificationType, waitForWebhooks } from "../../webhooks/webhookUtility"

export const caseDownloadSwitch = async (message: Message): Promise<string> => {
  const settings = (await Settings.findOne()) as settingsDocType
  if (!settings) return noDBPull()

  const channel = message.channel

  if (!("name" in channel) || !channel.name) {
    return "Wups! This command can only be used in a named server channel."
  }

  const channelErr = channelValid(channel, settings)
  if (typeof channelErr === "string") return channelErr

  switch (channel.name.toLowerCase()) {
    case settings.discord_bot.movie_channel_name.toLowerCase():
      return await caseDownloadMovie(message, settings)
    case settings.discord_bot.series_channel_name.toLowerCase():
      return await caseDownloadSeries(message, settings)
    default:
      return `${channel.name} is not a channel for downloading content. Please move to a different channel and try there.`
  }
}

// Download a movie and add it to the users pool
const caseDownloadMovie = async (message: Message, settings: settingsDocType): Promise<string> => {
  await sendDiscordMessage(message, randomProcessingMessage())

  // Check if Radarr is connected
  if (!settings.radarr_active) {
    return discordReply("Curses! Radarr is needed for this command.", "error")
  }

  // Validate the message
  const parsed = await validateDownload(message, settings, "Radarr")

  // Return if an error string is returned from validateDownload
  if (typeof parsed === "string") {
    return parsed
  }

  // If message is valid, give me the juicy data
  const { searchString, year, quality } = parsed

  // Find the user tied to the author
  const user = matchedUser(settings, message.author.username)
  if (!user) return `A Discord user by ${message.author.username} does not exist in the database.`

  // Check user pool limits
  const { limitError, currentLeft } = checkUserMovieLimit(user, settings)
  if (limitError) return discordReply(limitError, "info")

  // See what returns from the radarr API
  const foundMoviesArr = await searchRadarr(settings, searchString)

  // Return if nothing in search results
  if (!foundMoviesArr || foundMoviesArr.length === 0) {
    return randomNotFoundMessage()
  }

  // Sort foundMoviesArr so that if any titles are the same, the passed year is higher in the order
  const sortedMoviesArr = sortTMDBSearchArray<Movie>(foundMoviesArr, year)

  // Grab the first movie in the array
  const foundMovie = sortedMoviesArr[0]

  // Check if the movie is already downloaded
  if (foundMovie.movieFile) {
    // Check if the movie is in the user's pool - if not, re-add it
    const inUserPool = user.pool.movies.some((m) => m.tmdbId === foundMovie.tmdbId)

    if (!inUserPool) {
      settings.general_bot.users = settings.general_bot.users.map((u) => {
        if (u._id === user._id) {
          return {
            ...u,
            pool: {
              ...u.pool,
              movies: [...(u.pool.movies || []), foundMovie],
            },
          }
        }
        return u
      })

      if (!(await saveWithRetry(settings, "caseDownloadMovie - re-add to pool"))) return noDBSave()

      return discordReply(
        randomReAddedToPoolMessage(foundMovie.title),
        "success",
        `${user.name} | Re-added to pool | ${foundMovie.title}`,
      )
    }

    return randomAlreadyAddedMessage()
  }

  // If the foundMovie has been added to the library and therefore has an id
  if (foundMovie.id) {
    // Check if the movie is in the download queue
    const queue = await getRadarrQueue(settings)
    const movieInQueue = queue.find((movie) => movie.movieId === foundMovie.id)
    if (movieInQueue) return getMovieStatusMessage(movieInQueue.status, movieInQueue.timeleft)
  }

  // Track whether the movie is unreleased (will be used to branch webhook/reply behavior)
  const isUnreleased = !foundMovie.isAvailable

  // Retrieve Data Object
  const data = (await Data.findOne()) as dataDocType

  if (!data) {
    return discordReply(
      "I'm unable to find any data in the databse... This is extremely bad.",
      "catastrophic",
    )
  }

  // If the user specified a quality argument, find a matching profile by alias.
  // Otherwise, use the default profile from settings.
  let qualityProfile: QualityProfile

  if (quality) {
    const matched = findQualityProfileByAlias(quality, data, "Radarr")
    if (typeof matched === "string") return discordReply(matched, "info")
    qualityProfile = matched
  } else {
    const selectedQP = settings.general_bot.movie_quality_profile

    if (!selectedQP) {
      return discordReply(
        "A quality profile for movies has not been selected. Please inform the server owner!",
        "error",
        "!download command used but no quality profiles have been selected. Go to the API > Bots > Movie Quality Profile.",
      )
    }

    const matched = findQualityProfile(selectedQP, data, "Radarr")
    if (typeof matched === "string") return discordReply(matched, "error")
    qualityProfile = matched
  }

  // Grab rootFolder data
  const rootFolder = findRootFolder(data, "Radarr")

  if (typeof rootFolder === "string") {
    return discordReply(rootFolder, "error")
  }

  // Ensure we have enough free space on the drive to satisfy the selected min free space
  const freeSpaceErr = freeSpaceCheck(rootFolder.freeSpace, settings.general_bot.min_free_space)
  if (freeSpaceErr) return discordReply(freeSpaceErr, "error")

  // Download the movie
  let movie = null

  // If the movie exists in the library, just search for it. Otherwise, add and download the movie.
  if (foundMovie.id) {
    const searchRes = await searchMovieCommand(settings, foundMovie)

    if (!searchRes) {
      return discordReply(
        "That one is in my library but I can't download it. Please poke an admin!",
        "error",
      )
    }

    movie = await getMovie(settings, searchRes.body.movieIds[0])
  } else {
    movie = await downloadMovie(settings, foundMovie, qualityProfile.id, rootFolder.path)
  }

  if (!movie) {
    return discordReply(
      `Hmm.. something went wrong with the request to download ${searchString}. I do apologise!`,
      "error",
    )
  }

  // Guard against duplicate pool entries (e.g. user re-requests the same unreleased movie)
  const alreadyInPool = user.pool.movies.some((m) => m.tmdbId === movie.tmdbId)
  if (alreadyInPool) return randomAlreadyAddedMessage()

  // Add the movie to the users pool
  settings.general_bot.users = settings.general_bot.users.map((u) => {
    if (u._id === user._id) {
      return {
        ...u,
        pool: {
          ...u.pool,
          movies: [...(u.pool.movies || []), movie],
        },
      }
    }
    return u
  })

  // Save the new pool data to the database
  if (!(await saveWithRetry(settings, "caseDownloadMovie"))) return noDBSave()

  if (isUnreleased) {
    // Queue a persistent Import webhook for unreleased media (no Grab needed, no expiry - survives cleanup)
    if (settings.webhooks) {
      const queueNotifications: QueueNotificationType[] = []

      if (settings.webhooks_enabled.includes("Import")) {
        queueNotifications.push({
          waitForStatus: "Import",
          message: randomUnreleasedMovieReadyMessage(message.author.toString(), movie.title),
          persistent: true,
        })
      }

      if (queueNotifications.length > 0) {
        await waitForWebhooks(queueNotifications, "Radarr", ["Discord"], message, null, movie)
      }
    } else {
      logger.warn(
        `Webhook | Unreleased movie '${movie.title}' added by ${user.name} but webhooks are disabled. No download notification will be sent.`,
      )
    }

    return discordReply(
      randomUnreleasedAddedMessage(message.author.toString(), movie.title, movie.status),
      "success",
      `${user.name} | Unreleased Movie Added to Pool | ${movie.title} | They have ${currentLeft} pool allowance available for movies.`,
    )
  }

  // Released media: queue normal webhooks with standard expiry
  if (settings.webhooks) {
    const queueNotifications: QueueNotificationType[] = []

    if (settings.webhooks_enabled.includes("Import")) {
      queueNotifications.push({
        waitForStatus: "Import",
        message: randomMovieReadyMessage(message.author.toString(), movie.title),
        expiry: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours - cleaned up silently if no import
      })
    }

    if (settings.webhooks_enabled.includes("Grab")) {
      queueNotifications.push({
        waitForStatus: "Grab",
        message: randomGrabbedMessage(movie.title),
        expiry: new Date(Date.now() + 5 * 60 * 1000),
        expired_message: randomGrabNotFoundMessage(movie.title),
      })
    }

    if (queueNotifications.length > 0) {
      await waitForWebhooks(queueNotifications, "Radarr", ["Discord"], message, null, movie)
    }
  } else {
    // Start an asynchronous loop waiting for the movie to finish downloading. Then send a notification.
    notifyMovieDownloaded(message, settings, movie).catch((err) =>
      logger.error(`notifyMovieDownloaded: Something went wrong: ${err}`),
    )
  }

  // Notify that we've grabbed a movie with quality-aware feedback if applicable
  const movieStartMessage = quality
    ? randomMovieQualityDownloadStartMessage(movie, quality)
    : randomMovieDownloadStartMessage(movie)

  return discordReply(
    movieStartMessage,
    "success",
    `${user.name} | Started Movie Download | ${movie.title} | They have ${currentLeft} pool allowance available for movies.`,
  )
}

// Download a series and add it to the users pool
const caseDownloadSeries = async (message: Message, settings: settingsDocType): Promise<string> => {
  await sendDiscordMessage(message, randomProcessingMessage())

  // Check if Sonarr is connected
  if (!settings.sonarr_active) {
    return discordReply("Curses! Sonarr is needed for this command.", "error")
  }

  // Validate the message
  const parsed = await validateDownload(message, settings, "Sonarr")

  // Return if an error string is returned from validateDownload
  if (typeof parsed === "string") {
    return parsed
  }

  // If message is valid, give me the juicy data
  const { searchString, year, monitor, quality: seriesQuality } = parsed

  // Find the user tied to the author
  const user = matchedUser(settings, message.author.username)
  if (!user) return `A Discord user by ${message.author.username} does not exist in the database.`

  // Check user pool limits
  const { limitError, currentLeft } = checkUserSeriesLimit(user, settings)
  if (limitError) return discordReply(limitError, "info")

  // See what returns from the sonarr API
  const foundSeriesArr = await searchSonarr(settings, searchString)

  // Return if nothing in search results
  if (!foundSeriesArr || foundSeriesArr.length === 0) {
    return randomNotFoundMessage()
  }

  // Sort foundMoviesArr so that if any titles are the same, the passed year is higher in the order
  const sortedSeriesArr = sortTMDBSearchArray<Series>(foundSeriesArr, year)

  // Grab the first series in the array
  const foundSeries = sortedSeriesArr[0]

  // Track whether the series is unreleased (will be used to branch webhook/reply behavior)
  const isUnreleased = !isSeriesReleased(foundSeries)

  // Retrieve Data Object
  const data = (await Data.findOne()) as dataDocType

  if (!data) {
    return discordReply(
      "I'm unable to find any data in the databse... This is extremely bad.",
      "catastrophic",
    )
  }

  // Get latest series data from Sonarr
  const currentLibrary = await getSonarrLibrary(settings)

  if (!currentLibrary) {
    return discordReply(
      "It looks like there's no series data in the database. This is highly unusual.",
      "error",
    )
  }

  // Try matching by unique IDs in order of reliability
  const matchedSeries = currentLibrary.find(
    (l) =>
      l.tvdbId === foundSeries.tvdbId ||
      (foundSeries.tvMazeId && l.tvMazeId === foundSeries.tvMazeId) ||
      (foundSeries.tmdbId && l.tmdbId === foundSeries.tmdbId) ||
      (foundSeries.imdbId && l.imdbId === foundSeries.imdbId),
  )

  // Check if the series is already in the Sonarr library
  if (matchedSeries) {
    // Get the current monitor setting from the matched series (default to "all" if not set)
    const currentMonitor = matchedSeries.monitor || "all"

    // Scenario 1: Monitor matches or is "all" - check pool before returning
    if (currentMonitor === "all" || currentMonitor === monitor) {
      // Check if the series is in the user's pool - if not, re-add it
      const inUserPool = user.pool.series.some((s) => s.tvdbId === matchedSeries.tvdbId)

      if (!inUserPool) {
        settings.general_bot.users = settings.general_bot.users.map((u) => {
          if (u._id === user._id) {
            return {
              ...u,
              pool: {
                ...u.pool,
                series: [...(u.pool.series || []), { ...matchedSeries, monitor }],
              },
            }
          }
          return u
        })

        if (!(await saveWithRetry(settings, "caseDownloadSeries - re-add to pool")))
          return noDBSave()

        return discordReply(
          randomReAddedToPoolMessage(matchedSeries.title),
          "success",
          `${user.name} | Re-added to pool | ${matchedSeries.title}`,
        )
      }

      // Series is in the user's pool - return appropriate status message
      if (matchedSeries.statistics.percentOfEpisodes === 100) {
        return randomAlreadyAddedMessage()
      }

      // Series incomplete - check if already downloading
      const queue = await getSonarrQueue(settings)
      const episodesInQueue = queue.filter((q) => q.seriesId === foundSeries.id)

      if (episodesInQueue.length > 0) {
        const lastEpisode = episodesInQueue.at(-1)
        return randomEpisodesDownloadingMessage(episodesInQueue.length, lastEpisode?.timeleft)
      }

      // Series exists and monitoring matches - just return already added message
      return randomAlreadyAddedMessage()
    }

    // Scenario 2: Series has specific monitor that differs from user's request
    // Update series to monitor "all" and add to user's pool with their preference

    // Update series monitoring to "all" in Sonarr
    const updateSuccess = await updateSeriesMonitor(settings, matchedSeries.id, "all")

    if (!updateSuccess) {
      return discordReply(
        `Failed to update monitoring settings for ${foundSeries.title}. Please contact the server owner.`,
        "error",
        `Failed to update series monitoring for ${foundSeries.title} (ID: ${matchedSeries.id})`,
      )
    }

    // Wait 5 seconds to ensure Sonarr has processed the update
    await new Promise((resolve) => setTimeout(resolve, 5000))

    // Trigger search for newly monitored content
    const searchSuccess = await searchMonitoredSeries(settings, matchedSeries.id)

    if (!searchSuccess) {
      logger.error(
        `Failed to trigger search for ${foundSeries.title} after monitoring update, but monitoring was changed successfully.`,
      )
    }

    // Update the series in the database libraries to reflect "all"
    const sonarrLibrary = data.libraries.find((lib) => lib.name === "Sonarr")
    if (sonarrLibrary) {
      const librarySeriesIndex = (sonarrLibrary.data as Series[]).findIndex(
        (s) =>
          s.tvdbId === matchedSeries.tvdbId ||
          (s.title === matchedSeries.title && s.year === matchedSeries.year),
      )
      if (librarySeriesIndex !== -1) {
        ;(sonarrLibrary.data as Series[])[librarySeriesIndex] = {
          ...matchedSeries,
          monitor: "all",
        }
      }
    }

    // Save the updated data object
    if (!(await saveWithRetry(data, "caseDownloadSeries - update monitor"))) return noDBSave()

    // Add series to user's pool with their requested monitor value
    settings.general_bot.users = settings.general_bot.users.map((u) => {
      if (u._id === user._id) {
        return {
          ...u,
          pool: {
            ...u.pool,
            series: [...(u.pool.series || []), { ...matchedSeries, monitor }],
          },
        }
      }
      return u
    })

    // Save the updated settings
    if (!(await saveWithRetry(settings, "caseDownloadSeries - add to pool"))) return noDBSave()

    return discordReply(
      randomSeriesMonitorChangeToAllMessage(foundSeries.title),
      "success",
      `${user.name} requested ${foundSeries.title} with ${monitor}, updated to "all"`,
    )
  }

  // If the user specified a quality argument, find a matching profile by alias.
  // Otherwise, use the default profile from settings.
  let qualityProfile: QualityProfile

  if (seriesQuality) {
    const matched = findQualityProfileByAlias(seriesQuality, data, "Sonarr")
    if (typeof matched === "string") return discordReply(matched, "info")
    qualityProfile = matched
  } else {
    const selectedQP = settings.general_bot.series_quality_profile

    if (!selectedQP) {
      return discordReply(
        "A quality profile for series has not been selected. Please inform the server owner!",
        "error",
        "!download command used but no quality profiles have been selected. Go to the API > Bots > Series Quality Profile.",
      )
    }

    const matched = findQualityProfile(selectedQP, data, "Sonarr")
    if (typeof matched === "string") return discordReply(matched, "error")
    qualityProfile = matched
  }

  // Grab rootFolder data
  const rootFolder = findRootFolder(data, "Sonarr")

  if (typeof rootFolder === "string") {
    return discordReply(rootFolder, "error")
  }

  // Ensure we have enough free space on the drive to satisfy the selected min free space
  const freeSpaceErr = freeSpaceCheck(rootFolder.freeSpace, settings.general_bot.min_free_space)
  if (freeSpaceErr) return discordReply(freeSpaceErr, "error")

  // Download the Series
  const series = await downloadSeries(
    settings,
    foundSeries,
    qualityProfile.id,
    rootFolder.path,
    monitor,
  )

  if (!series) {
    return discordReply(
      `Hmm.. something went wrong with the request to download ${searchString}. I do apologise!`,
      "error",
    )
  }

  // Guard against duplicate pool entries (e.g. user re-requests the same unreleased series)
  const alreadyInPool = user.pool.series.some((s) => s.tvdbId === series.tvdbId)
  if (alreadyInPool) return randomAlreadyAddedMessage()

  // Add the series to the users pool
  settings.general_bot.users = settings.general_bot.users.map((u) => {
    if (u._id === user._id) {
      return {
        ...u,
        pool: {
          ...u.pool,
          series: [...(u.pool.series || []), { ...series, monitor }],
        },
      }
    }
    return u
  })

  // Save the new pool data to the database
  if (!(await saveWithRetry(settings, "caseDownloadSeries"))) return noDBSave()

  if (isUnreleased) {
    // Queue a persistent Import webhook for unreleased media (no Grab needed, no expiry - survives cleanup)
    if (settings.webhooks) {
      const queueNotifications: QueueNotificationType[] = []

      if (settings.webhooks_enabled.includes("Import")) {
        queueNotifications.push({
          waitForStatus: "Import",
          message: randomUnreleasedSeriesReadyMessage(message.author.toString(), series.title),
          persistent: true,
        })
      }

      if (queueNotifications.length > 0) {
        await waitForWebhooks(queueNotifications, "Sonarr", ["Discord"], message, null, series)
      }
    } else {
      logger.warn(
        `Webhook | Unreleased series '${series.title}' added by ${user.name} but webhooks are disabled. No download notification will be sent.`,
      )
    }

    return discordReply(
      randomUnreleasedAddedMessage(message.author.toString(), series.title),
      "success",
      `${user.name} | Unreleased Series Added to Pool | ${series.title} | They have ${currentLeft} pool allowance available for series.`,
    )
  }

  // Released media: queue normal webhooks with standard expiry
  if (settings.webhooks) {
    const queueNotifications: QueueNotificationType[] = []

    if (settings.webhooks_enabled.includes("Import")) {
      queueNotifications.push({
        waitForStatus: "Import",
        message: randomSeriesReadyMessage(message.author.toString(), series.title),
        expiry: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours - cleaned up silently if no import
      })
    }

    if (settings.webhooks_enabled.includes("Grab")) {
      queueNotifications.push({
        waitForStatus: "Grab",
        message: randomGrabbedMessage(series.title),
        expiry: new Date(Date.now() + 5 * 60 * 1000), // 5 Mins
        expired_message: randomGrabNotFoundMessage(series.title),
      })
    }

    if (queueNotifications.length > 0) {
      await waitForWebhooks(queueNotifications, "Sonarr", ["Discord"], message, null, series)
    }
  } else {
    // Start an asynchronous loop waiting for the series to finish downloading. Then send a notification.
    notifySeriesDownloaded(message, settings, series).catch((err) =>
      logger.error(`notifySeriesDownloaded: Something went wrong: ${err}`),
    )
  }

  // Select the appropriate message function based on which arguments were specified
  const hasQuality = !!seriesQuality
  const hasMonitor = monitor !== "all"

  let seriesStartMessage: string
  if (hasQuality && hasMonitor) {
    seriesStartMessage = randomSeriesQualityMonitorDownloadStartMessage(series, monitor, seriesQuality)
  } else if (hasQuality) {
    seriesStartMessage = randomSeriesQualityDownloadStartMessage(series, seriesQuality)
  } else if (hasMonitor) {
    seriesStartMessage = randomSeriesMonitorDownloadStartMessage(series, monitor)
  } else {
    seriesStartMessage = randomSeriesDownloadStartMessage(series)
  }

  return discordReply(
    seriesStartMessage,
    "success",
    `${user.name} | Started Series Download | ${series.title} | They have ${currentLeft} pool allowance available for series.`,
  )
}
