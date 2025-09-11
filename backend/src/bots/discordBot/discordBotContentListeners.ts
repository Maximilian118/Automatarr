import { Message } from "discord.js"
import Settings, { settingsDocType } from "../../models/settings"
import {
  discordReply,
  findChannelByName,
  findQualityProfile,
  findRootFolder,
  freeSpaceCheck,
  matchedDiscordUser,
  matchedUser,
  noDBPull,
  noDBSave,
  sendDiscordMessage,
} from "./discordBotUtility"
import {
  validateBlocklistCommand,
  validateDownload,
  validateListCommand,
  validateRemoveCommand,
  validateStayCommand,
  validateWaitCommand,
} from "./discordRequestValidation"
import { checkUserMovieLimit, checkUserSeriesLimit } from "./discordBotUserLimits"
import { searchMissing } from "../../shared/StarrRequests"
import {
  randomNotFoundMessage,
  randomAlreadyAddedMessage,
  randomAlreadyAddedWithMissingMessage,
  randomMissingEpisodesSearchInProgress,
  getMovieStatusMessage,
  randomEpisodesDownloadingMessage,
  randomMovieDownloadStartMessage,
  randomSeriesDownloadStartMessage,
  randomProcessingMessage,
  randomRemovalSuccessMessage,
  randomMovieReplacementMessage,
  randomEpisodeReplacementMessage,
  randomMovieReadyMessage,
  randomSeriesReadyMessage,
  randomInLibraryNotDownloadedMessage,
  randomAddedToPoolMessage,
  randomGrabbedMessage,
  randomGrabNotFoundMessage,
  randomNotReleasedMessage,
} from "./discordBotRandomReply"
import Data, { dataDocType } from "../../models/data"
import { saveWithRetry } from "../../shared/database"
import {
  deleteMovieFile,
  downloadMovie,
  getMovie,
  getMovieHistory,
  getRadarrQueue,
  markMovieAsFailed,
  searchMovieCommand,
  searchRadarr,
} from "../../shared/RadarrStarrRequests"
import {
  deleteEpisodeFile,
  downloadSeries,
  getEpisodeHistory,
  getSeriesEpisodes,
  getSonarrLibrary,
  getSonarrQueue,
  markEpisodeAsFailed,
  searchSonarr,
} from "../../shared/SonarrStarrRequests"
import logger from "../../logger"
import {
  notifyEpisodeDownloaded,
  notifyMovieDownloaded,
  notifySeriesDownloaded,
} from "./discordBotAsync"
import { isSeriesReleased, sortTMDBSearchArray } from "../botUtility"
import { Movie } from "../../types/movieTypes"
import { Series } from "../../types/seriesTypes"
import { channelValid } from "./discordBotRequestValidationUtility"
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
  const { searchString, year } = parsed

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
    return randomAlreadyAddedMessage()
  }

  // If the foundMovie has been added to the library and therefore has an id
  if (foundMovie.id) {
    // Check if the movie is in the download queue
    const queue = await getRadarrQueue(settings)
    const movieInQueue = queue.find((movie) => movie.movieId === foundMovie.id)
    if (movieInQueue) return getMovieStatusMessage(movieInQueue.status, movieInQueue.timeleft)
  }

  // Check to see if the movie is available
  if (!foundMovie.isAvailable) {
    return discordReply(
      randomNotReleasedMessage(message.author.toString(), foundMovie.title, foundMovie.status),
      "info",
      `${user.name} tried to download ${foundMovie.title} but it's not available.`,
    )
  }

  // Ensure a quality profile is selected
  const selectedQP = settings.general_bot.movie_quality_profile

  if (!selectedQP) {
    return discordReply(
      "A quality profile for movies has not been selected. Please inform the server owner!",
      "error",
      "!download command used but no quality profiles have been selected. Go to the API > Bots > Movie Quality Profile.",
    )
  }

  // Retrieve Data Object
  const data = (await Data.findOne()) as dataDocType

  if (!data) {
    return discordReply(
      "I'm unable to find any data in the databse... This is extremely bad.",
      "catastrophic",
    )
  }

  // Check Selected Quality Profile
  const qualityProfile = findQualityProfile(selectedQP, data, "Radarr")

  if (typeof qualityProfile === "string") {
    return discordReply(qualityProfile, "error")
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

  if (settings.webhooks) {
    const queueNotifications: QueueNotificationType[] = []

    if (settings.webhooks_enabled.includes("Import")) {
      queueNotifications.push({
        waitForStatus: "Import",
        message: randomMovieReadyMessage(message.author.toString(), movie.title),
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

  // Notify that we've grabbed a movie
  return discordReply(
    randomMovieDownloadStartMessage(movie),
    "success",
    `${user.name} | Started Movie Download | ${movie.title} | They have ${currentLeft} pool allowance available for movies.`,
  )
}

const lastSearchTimestamps: Map<string, number> = new Map()

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
  const { searchString, year } = parsed

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

  // Check if the series has been aired
  if (!isSeriesReleased(foundSeries)) {
    return discordReply(
      randomNotReleasedMessage(message.author.toString(), foundSeries.title),
      "info",
      `${user.name} tried to download ${foundSeries.title} but it's not available.`,
    )
  }

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
    if (matchedSeries.statistics.percentOfEpisodes === 100) {
      return randomAlreadyAddedMessage()
    }

    // Set up for the search missing rate limiting
    const now = Date.now()
    const lastSearchTime = lastSearchTimestamps.get("Sonarr") || 0
    const tenMinutes = 10 * 60 * 1000
    const errMsgIdent = `${user.name} | ${message.author.username} searched for the series ${searchString}.`

    // Check download Queue and see if any episodes for this series are currently being downloaded
    const queue = await getSonarrQueue(settings)
    const episodesInQueue = queue.filter((q) => q.seriesId === foundSeries.id)
    const lastEpisode = episodesInQueue.at(-1)

    if (episodesInQueue.length > 0) {
      return randomEpisodesDownloadingMessage(episodesInQueue.length, lastEpisode?.timeleft)
    }

    if (now - lastSearchTime < tenMinutes) {
      return discordReply(
        randomMissingEpisodesSearchInProgress(),
        "info",
        `${errMsgIdent} Missing episodes but search skipped due to cooldown.`,
      )
    }

    // Start a Sonarr wide wanted missing search - because yolo
    const commandList = data.commandList.find((cl) => cl.name === "Sonarr")?.data
    const searched = await searchMissing(
      commandList,
      "Sonarr",
      settings.sonarr_URL,
      settings.sonarr_API_version,
      settings.sonarr_KEY,
    )

    if (!searched) {
      return discordReply(
        `That series is already in the library, but some episodes are missing and I can't search for them. Please contact the server owner.`,
        "error",
        `${errMsgIdent} Series found with missing episodes, but search failed.`,
      )
    }

    // Update timestamp after successful search
    lastSearchTimestamps.set("Sonarr", now)

    return discordReply(
      randomAlreadyAddedWithMissingMessage(),
      "info",
      `${errMsgIdent} It has some missing episodes. Search started.`,
    )
  }

  // Ensure a quality profile is selected
  const selectedQP = settings.general_bot.series_quality_profile

  if (!selectedQP) {
    return discordReply(
      "A quality profile for series has not been selected. Please inform the server owner!",
      "error",
      "!download command used but no quality profiles have been selected. Go to the API > Bots > Series Quality Profile.",
    )
  }

  // Check Selected Quality Profile
  const qualityProfile = findQualityProfile(selectedQP, data, "Sonarr")

  if (typeof qualityProfile === "string") {
    return discordReply(qualityProfile, "error")
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
  const series = await downloadSeries(settings, foundSeries, qualityProfile.id, rootFolder.path)

  if (!series) {
    return discordReply(
      `Hmm.. something went wrong with the request to download ${searchString}. I do apologise!`,
      "error",
    )
  }

  // Add the series to the users pool
  settings.general_bot.users = settings.general_bot.users.map((u) => {
    if (u._id === user._id) {
      return {
        ...u,
        pool: {
          ...u.pool,
          series: [...(u.pool.series || []), series],
        },
      }
    }
    return u
  })

  // Save the new pool data to the database
  if (!(await saveWithRetry(settings, "caseDownloadSeries"))) return noDBSave()

  if (settings.webhooks) {
    const queueNotifications: QueueNotificationType[] = []

    if (settings.webhooks_enabled.includes("Import")) {
      queueNotifications.push({
        waitForStatus: "Import",
        message: randomSeriesReadyMessage(message.author.toString(), series.title),
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

  return discordReply(
    randomSeriesDownloadStartMessage(series),
    "success",
    `${user.name} | Started Series Download | ${series.title} | They have ${currentLeft} pool allowance available for series.`,
  )
}

// List items in a users pool
export const caseList = async (message: Message): Promise<string> => {
  const settings = (await Settings.findOne()) as settingsDocType
  if (!settings) return noDBPull()

  // Validate the request string: `!list <optional_contentType> <optional_discord_username>`
  const msgArr = message.content.slice().trim().split(/\s+/)
  const validationError = validateListCommand(msgArr)
  if (validationError) return validationError

  // Extract guildMember while checking if <discord_username> exists on the server
  const targetUser = msgArr[2] ? msgArr[2] : message.author.username
  const guildMember = await matchedDiscordUser(message, targetUser)
  if (!guildMember) return `The user \`${msgArr[2]}\` does not exist in this server.`
  const username = guildMember.user.username

  // Find the target user in the database
  const user = matchedUser(settings, username)
  if (!user) return `A Discord user by <@${guildMember.id}> does not exist in the database.`

  const contentType =
    msgArr[1] && (msgArr[1].toLowerCase() as "pool" | "movie" | "movies" | "series")

  // If channels exist extreact mentions for better discord UX
  const { mention: movieChannel } = findChannelByName(settings.discord_bot.movie_channel_name)
  const { mention: seriesChannel } = findChannelByName(settings.discord_bot.series_channel_name)

  // Get the maximums for the user
  const { currentMovieMax } = checkUserMovieLimit(user, settings)
  const { currentSeriesMax } = checkUserSeriesLimit(user, settings)

  const moviesList =
    user.pool.movies.length === 0
      ? `No Movies yet! ${
          !msgArr[2]
            ? `Use the !download command in the ${movieChannel} channel to download your first movie!`
            : ""
        }`
      : user.pool.movies.map((movie, i) => `${i}. ${movie.title} ${movie.year}`).join("\n") +
        `\n(Maximum: ${currentMovieMax})`

  const movies = `Movies:\n` + moviesList + "\n"

  const seriesList =
    user.pool.series.length === 0
      ? `No Series yet! ${
          !msgArr[2]
            ? `Use the !download command in the ${seriesChannel} channel to download your first series!`
            : ""
        }`
      : user.pool.series.map((series, i) => `${i}. ${series.title} ${series.year}`).join("\n") +
        `\n(Maximum: ${currentSeriesMax})`

  const series = `Series:\n` + seriesList + "\n"

  return (
    `🎞️ Content Pool for <@${guildMember.id}>\n` +
    `\n` +
    (!contentType || contentType === "pool"
      ? `${movies}\n` + series
      : contentType.includes("movie")
      ? movies
      : contentType === "series"
      ? series
      : "")!
  )
}

// Remove an item from the users pool
export const caseRemove = async (message: Message): Promise<string> => {
  const settings = (await Settings.findOne()) as settingsDocType
  if (!settings) return noDBPull()

  // Validate the request string: `!remove <Index/Title + Year>`
  const parsed = await validateRemoveCommand(message, settings)
  if (typeof parsed === "string") return parsed

  const { channel, poolItemTitle, contentTitle, contentYear, contentType } = parsed

  if (!("name" in channel) || !channel.name) {
    return "Wups! This command can only be used in a named server channel."
  }

  // Get guildMember while checking if <discord_username> exists on the server
  const guildMember = await matchedDiscordUser(message, message.author.username)
  if (!guildMember) return `The user \`${message.author.username}\` does not exist in this server.`
  const username = guildMember.user.username

  // Get user while checking if user exists in the database
  let user = matchedUser(settings, username)
  if (!user) return `A Discord user by <@${guildMember.id}> does not exist in the database.`

  const plural = contentType === "movie" ? "movies" : "series"

  // Remove from the user's pool
  const originalPoolSize =
    contentType === "movie" ? user.pool.movies.length : user.pool.series.length

  settings.general_bot.users = settings.general_bot.users.map((u) => {
    if (user && u._id !== user._id) return u

    const pool = u.pool
    // Use robust comparison for title+year, fallback to string comparison for index-based removal
    const updatedMovies =
      channel.name === settings.discord_bot.movie_channel_name
        ? pool.movies.filter((m) => {
            if (contentTitle !== null && contentYear !== null) {
              return !(
                m.title.toLowerCase().trim() === contentTitle.toLowerCase().trim() &&
                Number(m.year) === Number(contentYear)
              )
            }
            return `${m.title} ${m.year}` !== poolItemTitle
          })
        : pool.movies

    const updatedSeries =
      channel.name === settings.discord_bot.series_channel_name
        ? pool.series.filter((s) => {
            if (contentTitle !== null && contentYear !== null) {
              return !(
                s.title.toLowerCase().trim() === contentTitle.toLowerCase().trim() &&
                Number(s.year) === Number(contentYear)
              )
            }
            return `${s.title} ${s.year}` !== poolItemTitle
          })
        : pool.series

    const newUser = {
      ...u,
      pool: {
        ...pool,
        movies: updatedMovies,
        series: updatedSeries,
      },
    }

    user = newUser
    return newUser
  })

  // Check if anything was actually removed
  const newPoolSize = contentType === "movie" ? user.pool.movies.length : user.pool.series.length

  if (originalPoolSize === newPoolSize) {
    return `I couldn't not find "${poolItemTitle}" in your ${plural} pool. Use \`!list ${plural}\` to see your current ${plural}.`
  }

  // Save the new pool data to the database
  if (!(await saveWithRetry(settings, "caseRemove"))) return noDBSave()

  const { currentLeft } =
    contentType === "movie"
      ? checkUserMovieLimit(user, settings)
      : checkUserSeriesLimit(user, settings)

  return discordReply(
    randomRemovalSuccessMessage(poolItemTitle, contentType),
    "success",
    `${user.name} | Removed a ${contentType} | ${poolItemTitle} | They have ${currentLeft} pool allowance available for ${plural}.`,
  )
}

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

// Download a movie and add it to the users pool
export const caseWaitTime = async (message: Message): Promise<string> => {
  const settings = (await Settings.findOne()) as settingsDocType
  if (!settings) return noDBPull()

  const data = (await Data.findOne()) as dataDocType
  if (!data) return noDBPull()

  // Validate the message
  const parsed = await validateWaitCommand(message, settings, data)

  // Return if an error string is returned from validateDownload
  if (typeof parsed === "string") {
    return parsed
  }

  // If message is valid, give me the juicy data
  const { channel, searchString, year } = parsed

  // Find the user tied to the author
  const user = matchedUser(settings, message.author.username)
  if (!user) return `A Discord user by ${message.author.username} does not exist in the database.`

  if (!("name" in channel) || !channel.name) {
    return "Wups! This command can only be used in a named server channel."
  }

  // If user is in movie channel
  if (channel.name === settings.discord_bot.movie_channel_name) {
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
      return randomAlreadyAddedMessage()
    }

    // Check if the movie is in the download queue
    const queue = await getRadarrQueue(settings)
    const movieInQueue = queue.find((movie) => movie.movieId === foundMovie.id)
    if (movieInQueue) return getMovieStatusMessage(movieInQueue.status, movieInQueue.timeleft)
  }

  // If user is in series channel
  if (channel.name === settings.discord_bot.series_channel_name) {
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
      if (matchedSeries.statistics.percentOfEpisodes === 100) {
        return randomAlreadyAddedMessage()
      }

      // Check download Queue and see if any episodes for this series are currently being downloaded
      const queue = await getSonarrQueue(settings)
      const episodesInQueue = queue.filter((q) => q.seriesId === foundSeries.id)
      const lastEpisode = episodesInQueue.at(-1)

      if (episodesInQueue.length > 0) {
        return randomEpisodesDownloadingMessage(episodesInQueue.length, lastEpisode?.timeleft)
      }
    }
  }

  // If we can't find the item in library or queue, just return a not found message.
  return randomNotFoundMessage()
}

// Ensure some content isn't deleted by adding it to your user pool
export const caseStay = async (message: Message): Promise<string> => {
  const settings = (await Settings.findOne()) as settingsDocType
  if (!settings) return noDBPull()

  const data = (await Data.findOne()) as dataDocType
  if (!data) return noDBPull()

  // Validate the message
  const parsed = await validateStayCommand(message, settings, data)

  // Return if an error string is returned from validateDownload
  if (typeof parsed === "string") {
    return parsed
  }

  // If message is valid, give me the juicy data
  const { channel, searchString, year } = parsed

  // Find the user tied to the author
  const user = matchedUser(settings, message.author.username)
  if (!user) return `A Discord user by ${message.author.username} does not exist in the database.`

  if (!("name" in channel) || !channel.name) {
    return "Wups! This command can only be used in a named server channel."
  }

  // If user is in movie channel
  if (channel.name === settings.discord_bot.movie_channel_name) {
    // See what returns from the radarr API
    const foundMoviesArr = await searchRadarr(settings, searchString)

    // Return if nothing in search results
    if (!foundMoviesArr || foundMoviesArr.length === 0) {
      return randomNotFoundMessage()
    }

    // Sort foundMoviesArr so that if any titles are the same, the passed year is higher in the order
    const sortedMoviesArr = sortTMDBSearchArray<Movie>(foundMoviesArr, year)

    // Grab the first movie in the search array
    const foundMovie = sortedMoviesArr[0]

    // Ensure the movie is downloaded
    if (!foundMovie.movieFile) {
      return randomInLibraryNotDownloadedMessage()
    }

    // Check if this movie is already in the users pool
    const movieMatch = user.pool.movies.find((m) => m.tmdbId === foundMovie.tmdbId)
    if (movieMatch) return `${foundMovie.title} is already in your pool silly goose!`

    // Add the movie to the user pool
    settings.general_bot.users = settings.general_bot.users.map((u) => {
      if (u._id === user._id) {
        return {
          ...u,
          pool: {
            ...u.pool,
            movies: [...u.pool.movies, foundMovie],
          },
        }
      } else {
        return u
      }
    })

    // Save to the database
    await saveWithRetry(settings, "caseStay")

    return randomAddedToPoolMessage("Movie", foundMovie.title)
  }

  // If user is in series channel
  if (channel.name === settings.discord_bot.series_channel_name) {
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

    const seriesLibrary = data.libraries.find((API) => API.name === "Sonarr")?.data as
      | Series[]
      | undefined
    if (!seriesLibrary) return "There is no series data in the database... this is bad."

    const seriesInDB = seriesLibrary.find((s) => s.tmdbId === foundSeries.tmdbId)
    if (!seriesInDB) return randomNotFoundMessage()

    // Check if this series is already in the users pool
    const seriesMatch = user.pool.series.find((m) => m.tmdbId === foundSeries.tmdbId)
    if (seriesMatch) return `${foundSeries.title} is already in your pool silly goose!`

    // Add the movie to the user pool
    settings.general_bot.users = settings.general_bot.users.map((u) => {
      if (u._id === user._id) {
        return {
          ...u,
          pool: {
            ...u.pool,
            series: [...u.pool.series, seriesInDB],
          },
        }
      } else {
        return u
      }
    })

    // Save to the database
    await saveWithRetry(settings, "caseStay")

    return randomAddedToPoolMessage("Series", seriesInDB.title)
  }

  // If we can't find the item in library or queue, just return a not found message.
  return randomNotFoundMessage()
}
