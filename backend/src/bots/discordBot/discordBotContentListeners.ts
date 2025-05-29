import { Message } from "discord.js"
import Settings, { settingsDocType } from "../../models/settings"
import { discordReply, matchedUser, noDBPull } from "./discordBotUtility"
import { channelValid, validateDownload } from "./discordRequestValidation"
import { checkUserMovieLimit } from "./discordBotUserLimits"
import { searchRadarr } from "../../shared/StarrRequests"
import { randomNotFoundMessage, randomAlreadyAddedMessage } from "./discordBotRandomReply"

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
    return discordReply("Curses! Radarr is not connected at the moment.", "error")
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
