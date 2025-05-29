import { Message } from "discord.js"
import Settings, { settingsDocType } from "../../models/settings"
import { noDBPull } from "./discordBotUtility"
import { channelValid } from "./discordRequestValidation"

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
  console.log(message)
  console.log(settings.id)
  console.log("MOVIE")
  return "MOVIE"
}

// Download a series and add it to the users pool
const caseDownloadSeries = async (message: Message, settings: settingsDocType): Promise<string> => {
  console.log(message)
  console.log(settings.id)
  console.log("SERIES")
  return "SERIES"
}
