import { Message } from "discord.js"
import Settings, { settingsDocType } from "../../models/settings"
import {
  discordReply,
  findQualityProfile,
  findRootFolder,
  freeSpaceCheck,
  matchedUser,
  noDBPull,
  noDBSave,
} from "./discordBotUtility"
import { channelValid, validateDownload } from "./discordRequestValidation"
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
} from "./discordBotRandomReply"
import Data, { dataDocType } from "../../models/data"
import { saveWithRetry } from "../../shared/database"
import { downloadMovie, getRadarrQueue, searchRadarr } from "../../shared/RadarrStarrRequests"
import {
  downloadSeries,
  getSonarrLibrary,
  getSonarrQueue,
  searchSonarr,
} from "../../shared/SonarrStarrRequests"

export const caseDownloadSwitch = async (message: Message): Promise<string> => {
  const settings = (await Settings.findOne()) as settingsDocType
  if (!settings) return noDBPull()

  const channel = message.channel

  if (!("name" in channel) || !channel.name) {
    return "Wups! This command can only be used in a named server channel."
  }

  const channelError = channelValid(channel, settings)
  if (channelError) return channelError

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
  // Check if Radarr is connected
  if (!settings.radarr_active) {
    return discordReply("Curses! Radarr is needed for this command.", "error")
  }

  // Validate the message
  const parsed = validateDownload(message.content, "Radarr")

  // Return if an error string is returned from validateDownload
  if (typeof parsed === "string") {
    return discordReply(parsed, "error")
  }

  // If message is valid, give me the juicy data
  const { searchString } = parsed

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

  // Grab the first movie in the array
  const foundMovie = foundMoviesArr[0]

  // Check if the movie is already downloaded
  if (foundMovie.movieFile) {
    return randomAlreadyAddedMessage()
  }

  // Check if the movie is in the download queue
  const queue = await getRadarrQueue(settings)
  const movieInQueue = queue.find((movie) => movie.movieId === foundMovie.id)
  if (movieInQueue) return getMovieStatusMessage(movieInQueue.status, movieInQueue.timeleft)

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
  const movie = await downloadMovie(settings, foundMovie, qualityProfile.id, rootFolder.path)

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
          movies: [...u.pool.movies, movie],
        },
      }
    } else {
      return u
    }
  })

  // Save the new pool data to the database
  if (!(await saveWithRetry(settings, "caseDownloadMovie"))) return noDBSave()

  return discordReply(
    randomMovieDownloadStartMessage(movie),
    "success",
    `${user.name} | ${message.author.username} started a Radarr download of ${movie.title}. They have ${currentLeft} pool allowance available for movies.`,
  )
}

const lastSearchTimestamps: Map<string, number> = new Map()

// Download a series and add it to the users pool
const caseDownloadSeries = async (message: Message, settings: settingsDocType): Promise<string> => {
  // Check if Sonarr is connected
  if (!settings.sonarr_active) {
    return discordReply("Curses! Sonarr is needed for this command.", "error")
  }

  // Validate the message
  const parsed = validateDownload(message.content, "Sonarr")

  // Return if an error string is returned from validateDownload
  if (typeof parsed === "string") {
    return discordReply(parsed, "error")
  }

  // If message is valid, give me the juicy data
  const { searchString } = parsed

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

  // Grab the first series in the array
  const foundSeries = foundSeriesArr[0]

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

    if (episodesInQueue.length > 0) {
      return randomEpisodesDownloadingMessage(episodesInQueue.length)
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
          series: [...u.pool.series, series],
        },
      }
    } else {
      return u
    }
  })

  // Save the new pool data to the database
  if (!(await saveWithRetry(settings, "caseDownloadSeries"))) return noDBSave()

  return discordReply(
    randomSeriesDownloadStartMessage(series),
    "success",
    `${user.name} | ${message.author.username} started a series download of ${series.title}. They have ${currentLeft} pool allowance available for series.`,
  )
}
