import { Message } from "discord.js"
import Settings, { BotUserType, settingsDocType } from "../../models/settings"
import {
  discordReply,
  findQualityProfile,
  findQualityProfileByAlias,
  findRootFolder,
  freeSpaceCheck,
  getQualityGroup,
  matchedUser,
  noDBPull,
  noDBSave,
  resolutionToQualityGroup,
  sendProcessingMessage,
} from "./discordBotUtility"
import { validateDownload } from "./validate/validateDownload"
import { checkUserMovieLimit, checkUserSeriesLimit } from "./discordBotUserLimits"
import {
  randomNotFoundMessage,
  randomAlreadyAddedMessage,
  randomAlreadyDownloadedInQualityMessage,
  downloadStateMessage,
  notDownloadingMessage,
  randomMovieDownloadStartMessage,
  randomMovieQualityDownloadStartMessage,
  randomSeriesDownloadStartMessage,
  randomSeriesMonitorDownloadStartMessage,
  randomSeriesQualityDownloadStartMessage,
  randomSeriesQualityMonitorDownloadStartMessage,
  randomSeriesMonitorChangeToAllMessage,
  randomMovieQueueMessage,
  randomSeriesQueueMessage,
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
  searchMovieCommand,
  searchRadarr,
  updateMovieQualityProfile,
} from "../../shared/RadarrStarrRequests"
import {
  downloadSeries,
  getSonarrLibrary,
  searchSonarr,
  updateSeriesMonitor,
  searchMonitoredSeries,
} from "../../shared/SonarrStarrRequests"
import logger from "../../logger"
import { queueDownloadNotifications } from "./discordBotAsync"
import { registerDownloadPriority } from "../../shared/downloadPriority"
import { handleMovieQualityChange, handleSeriesQualityChange } from "./discordBotQualityChange"
import { isSeriesReleased, sortTMDBSearchArray } from "../botUtility"
import { Movie } from "../../types/movieTypes"
import { QualityProfile } from "../../types/qualityProfileType"
import { Series } from "../../types/seriesTypes"
import { channelValid } from "./validate/validationUtility"
import { QueueNotificationType, waitForWebhooks } from "../../webhooks/webhookUtility"
import { resolveInvalidCommand } from "./ai/aiHandlers"
import { logRequest } from "./ai/aiRequestLog"
import { downloadState, getDownloadSnapshot, recordsFor } from "../../shared/downloadStatus"

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
// Add a movie to a user's pool and save the settings. Returns false if the save failed.
const addMovieToPool = async (
  settings: settingsDocType,
  userId: BotUserType["_id"],
  movie: Movie,
  context: string,
): Promise<boolean> => {
  settings.general_bot.users = settings.general_bot.users.map((u) =>
    u._id === userId ? { ...u, pool: { ...u.pool, movies: [...(u.pool.movies || []), movie] } } : u,
  )

  return !!(await saveWithRetry(settings, context))
}

const caseDownloadMovie = async (message: Message, settings: settingsDocType): Promise<string> => {
  await sendProcessingMessage(message)

  // Check if Radarr is connected
  if (!settings.radarr_active) {
    return discordReply("Curses! Radarr is needed for this command.", "error")
  }

  // Validate the message
  const parsed = await validateDownload(message, settings, "Radarr")

  // Return the error, or let the AI work out what the user meant
  if (typeof parsed === "string") return resolveInvalidCommand(message, parsed)

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

  // The lookup can carry a stale file record, so ask Radarr whether the file is really there.
  // A film in the library without a file carries on below to the queue check and a search.
  const libraryMovie = foundMovie.id ? ((await getMovie(settings, foundMovie.id)) ?? foundMovie) : foundMovie
  const inUserPool = user.pool.movies.some((m) => m.tmdbId === foundMovie.tmdbId)

  // Check if the movie is already downloaded
  if (libraryMovie.hasFile && libraryMovie.movieFile) {
    // Check if the movie is in the user's pool - if not, add it
    if (!inUserPool) {
      if (!(await addMovieToPool(settings, user._id, libraryMovie, "caseDownloadMovie - re-add to pool"))) {
        return noDBSave()
      }
      await logRequest(message, "movie", libraryMovie, "readd")

      return discordReply(
        randomReAddedToPoolMessage(libraryMovie.title),
        "success",
        `${user.name} | Added downloaded movie to pool | ${libraryMovie.title}`,
      )
    }

    // Content that has already been downloaded is left as is, even if a different quality was requested
    const fileQuality = resolutionToQualityGroup(libraryMovie.movieFile.quality?.quality?.resolution)
    if (quality && fileQuality && fileQuality !== getQualityGroup(quality)) {
      return randomAlreadyDownloadedInQualityMessage(libraryMovie.title, fileQuality)
    }

    return randomAlreadyAddedMessage()
  }

  // Retrieve Data Object
  const data = (await Data.findOne()) as dataDocType

  if (!data) {
    return discordReply(
      "I'm unable to find any data in the databse... This is extremely bad.",
      "catastrophic",
    )
  }

  // If the foundMovie has been added to the library and therefore has an id
  if (foundMovie.id) {
    // Check if the movie is in the download queue
    const snapshot = await getDownloadSnapshot(settings, ["movie"])
    const movieQueueItems = recordsFor(snapshot, "movie", foundMovie.id)

    if (movieQueueItems.length > 0) {
      // A quality argument means the user may have changed their mind about the quality mid download
      if (quality) {
        return await handleMovieQualityChange(
          message,
          settings,
          data,
          foundMovie,
          movieQueueItems,
          quality,
        )
      }

      // Someone else's download: add it to this user's pool too and tell them when it's ready
      if (!inUserPool) {
        if (!(await addMovieToPool(settings, user._id, libraryMovie, "caseDownloadMovie - join download"))) {
          return noDBSave()
        }
        await logRequest(message, "movie", libraryMovie, "download")
        await queueDownloadNotifications(message, settings, libraryMovie, "Radarr", true)
      }

      const state = downloadState(movieQueueItems, snapshot)
      return state ? downloadStateMessage(state) : randomAlreadyAddedMessage()
    }
  }

  // Track whether the movie is unreleased (will be used to branch webhook/reply behavior)
  const isUnreleased = !foundMovie.isAvailable

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
    // Apply a newly requested quality before searching
    if (quality && foundMovie.qualityProfileId !== qualityProfile.id) {
      await updateMovieQualityProfile(settings, [foundMovie.id], qualityProfile.id)
    }

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

  // Add the movie to the users pool and save it
  if (!(await addMovieToPool(settings, user._id, movie, "caseDownloadMovie"))) return noDBSave()
  await logRequest(message, "movie", movie, "download")

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

  // Released media: notify the requester when the movie is grabbed and downloaded
  await queueDownloadNotifications(message, settings, movie, "Radarr")

  // Move the movie to the front of the download queue and find out if it has to wait for anyone
  const queueConflict = await registerDownloadPriority(message, movie, "movie")

  // Notify that we've grabbed a movie with queue and quality-aware feedback if applicable
  const movieStartMessage =
    randomMovieQueueMessage(movie, queueConflict, quality) ??
    (quality
      ? randomMovieQualityDownloadStartMessage(movie, quality)
      : randomMovieDownloadStartMessage(movie))

  return discordReply(
    movieStartMessage,
    "success",
    `${user.name} | Started Movie Download | ${movie.title} | They have ${currentLeft} pool allowance available for movies.`,
  )
}

// Say where an incomplete library series is in the download queue. If nothing is downloading,
// start a search for its missing episodes.
const seriesProgressMessage = async (settings: settingsDocType, series: Series): Promise<string> => {
  const snapshot = await getDownloadSnapshot(settings, ["series"])
  const state = downloadState(recordsFor(snapshot, "series", series.id), snapshot)
  if (state) return downloadStateMessage(state)

  await searchMonitoredSeries(settings, series.id)
  return notDownloadingMessage(series.title, "I've started a search for the missing episodes")
}

// Download a series and add it to the users pool
const caseDownloadSeries = async (message: Message, settings: settingsDocType): Promise<string> => {
  await sendProcessingMessage(message)

  // Check if Sonarr is connected
  if (!settings.sonarr_active) {
    return discordReply("Curses! Sonarr is needed for this command.", "error")
  }

  // Validate the message
  const parsed = await validateDownload(message, settings, "Sonarr")

  // Return the error, or let the AI work out what the user meant
  if (typeof parsed === "string") return resolveInvalidCommand(message, parsed)

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
        await logRequest(message, "series", matchedSeries, "readd")

        // Only say it's already downloaded when every episode is. Otherwise say what's happening.
        const reply =
          matchedSeries.statistics.percentOfEpisodes === 100
            ? randomReAddedToPoolMessage(matchedSeries.title)
            : await seriesProgressMessage(settings, matchedSeries)

        return discordReply(reply, "success", `${user.name} | Added series to pool | ${matchedSeries.title}`)
      }

      // A quality argument means the user may have changed their mind about the quality
      if (seriesQuality) {
        return await handleSeriesQualityChange(message, settings, data, matchedSeries, seriesQuality)
      }

      // Series is in the user's pool - return appropriate status message
      if (matchedSeries.statistics.percentOfEpisodes === 100) {
        return randomAlreadyAddedMessage()
      }

      // Series incomplete - say what's downloading, or search for what's missing
      return seriesProgressMessage(settings, matchedSeries)
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

    // Move the series to the front of the download queue and find out if it has to wait for anyone
    const queueConflict = await registerDownloadPriority(message, matchedSeries, "series")

    return discordReply(
      randomSeriesQueueMessage(matchedSeries, queueConflict) ??
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
  await logRequest(message, "series", series, "download")

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

  // Released media: notify the requester when the series is grabbed and downloaded
  await queueDownloadNotifications(message, settings, series, "Sonarr")

  // Move the series to the front of the download queue and find out if it has to wait for anyone.
  // Future-only series have nothing to download yet.
  const queueConflict =
    monitor === "future" ? null : await registerDownloadPriority(message, series, "series")

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
    randomSeriesQueueMessage(series, queueConflict, seriesQuality, monitor) ?? seriesStartMessage,
    "success",
    `${user.name} | Started Series Download | ${series.title} | They have ${currentLeft} pool allowance available for series.`,
  )
}
