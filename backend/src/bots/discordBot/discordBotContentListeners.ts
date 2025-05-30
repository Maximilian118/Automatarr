import { Message } from "discord.js"
import Settings, { settingsDocType } from "../../models/settings"
import {
  discordReply,
  findQualityProfile,
  findRootFolder,
  freeSpaceCheck,
  matchedUser,
  noDBPull,
} from "./discordBotUtility"
import { channelValid, validateDownload } from "./discordRequestValidation"
import { checkUserMovieLimit } from "./discordBotUserLimits"
import { getRadarrQueue, searchRadarr } from "../../shared/StarrRequests"
import {
  randomNotFoundMessage,
  randomAlreadyAddedMessage,
  getStatusMessage,
} from "./discordBotRandomReply"
import Data, { dataDocType } from "../../models/data"

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
  const parsed = validateDownload(message.content)

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
  const { limitError } = checkUserMovieLimit(user, settings)
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
  if (movieInQueue) return getStatusMessage(movieInQueue.status, movieInQueue.timeleft)

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

  // Add the movie to the users pool

  // Save the new pool data to the database

  return searchString
}

// Download a series and add it to the users pool
const caseDownloadSeries = async (message: Message, settings: settingsDocType): Promise<string> => {
  console.log(message)
  console.log(settings.id)
  console.log("SERIES")
  return "SERIES"
}
