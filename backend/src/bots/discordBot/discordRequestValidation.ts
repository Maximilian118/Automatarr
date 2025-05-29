import { settingsDocType } from "../../models/settings"
import { Channel, GuildTextBasedChannel } from "discord.js"
import { getDiscordClient } from "./discordBot"
import { discordReply } from "./discordBotUtility"

// Validate the array data for the caseOwner message
export const validateOwnerCommand = (msgArr: string[]): string => {
  if (msgArr.length !== 2) {
    return "The !owner command must contain exactly two parts: `!owner <discord_username>`."
  }

  const [command] = msgArr

  if (command.toLowerCase() !== "!owner") {
    return `Invalid command \`${command}\`.`
  }

  return ""
}

// Validate the array data for the caseAdmin message
export const validateAdminCommand = (msgArr: string[]): string => {
  if (msgArr.length !== 3) {
    return "The !admin command must contain exactly three parts: `!admin <add/remove> <discord_username>`."
  }

  const [command, action] = msgArr

  if (command.toLowerCase() !== "!admin") {
    return `Invalid command \`${command}\`.`
  }

  if (!["add", "remove"].includes(action?.toLowerCase())) {
    return `Invalid action \`${action}\`. Please use \`add\` or \`remove\`.`
  }

  return ""
}

// Validate the array data for the caseSuperUser message
export const validateSuperUser = (msgArr: string[]): string => {
  if (msgArr.length !== 3) {
    return "The !superuser command must contain exactly three parts: `!superuser <add/remove> <discord_username>`."
  }

  const [command, action] = msgArr

  if (command.toLowerCase() !== "!superuser") {
    return `Invalid command \`${command}\`.`
  }

  if (!["add", "remove"].includes(action?.toLowerCase())) {
    return `Invalid action \`${action}\`. Please use \`add\` or \`remove\`.`
  }

  return ""
}

// Validate the array data for the caseInit message
export const validateInitCommand = (msgArr: string[]): string => {
  const validCommands = ["!initialize", "!initialise", "!init"]

  if (msgArr.length !== 3) {
    return "The !init command must contain exactly three parts: `!init <discord_username> <display_name>`."
  }

  const [command, _, displayName] = msgArr

  if (!validCommands.includes(command.toLowerCase())) {
    return `Invalid command \`${command}\`. Use one of these: ${validCommands.join(", ")}.`
  }

  const displayNameRegex = /^[a-zA-Z]{1,20}$/
  if (!displayNameRegex.test(displayName)) {
    return `\`${displayName}\` is invalid. A display name must contain only letters and be no more than 20 characters long.`
  }

  return ""
}

// Validate the array data for the caseDelete message
export const validateDeleteCommand = (msgArr: string[]): string => {
  if (msgArr.length !== 2) {
    return "The !delete command must contain exactly two parts: `!delete <discord_username>`."
  }

  const [command] = msgArr

  if (command.toLowerCase() !== "!delete") {
    return `Invalid command \`${command}\`.`
  }

  return ""
}

// Validate the array data for the caseDelete message
export const validateRemoveCommand = (msgArr: string[]): string => {
  if (msgArr.length !== 2) {
    return "The !remove command must contain exactly two parts: `!remove <discord_username>`."
  }

  const [command] = msgArr

  if (command.toLowerCase() !== "!remove") {
    return `Invalid command \`${command}\`.`
  }

  return ""
}

// Validate the array data for the caseInit message
// prettier-ignore
export const validateDownload = (msgContent: string): string | {
  command: string
  title: string
  year: string
  searchString: string
} => {
  const msgArr = msgContent.trim().split(/\s+/)

  if (msgArr.length < 3) {
    return `The !download command must contain a movie title and a 4-digit year. For example: !download Top Gun 1986`
  }

  const [command, ...rest] = msgArr

  if (command.toLowerCase() !== "!download") {
    return `Invalid command \`${command}\`.`
  }

  const yearCandidate = rest[rest.length - 1]
  const yearMatch = yearCandidate.match(/^\d{4}$/)

  if (!yearMatch) {
    return "The last part of the command must be a 4-digit year. For example: 1994"
  }

  const year = yearCandidate
  const title = rest.slice(0, -1).join(" ")

  // TMDB-safe title validation (basic ASCII + common punctuation)
  const invalidCharMatch = title.match(/[^a-zA-Z0-9 ':,\-&.]/)
  if (invalidCharMatch) {
    return `The movie title contains unsupported characters: \`${invalidCharMatch[0]}\``
  }

  return {
    command,
    title,
    year,
    searchString: `${title} ${year}`,
  }
}

const isTextChannel = (channel: Channel): channel is GuildTextBasedChannel => {
  // Check if it's a guild text channel or news channel (both have name)
  return channel.isTextBased() && "name" in channel
}

// Check channel the message was sent in is a valid download channel
export const channelValid = (channel: Channel, settings: settingsDocType): string => {
  if (!("name" in channel) || !channel.name) {
    return "Wups! This command can only be used in a named server channel."
  }

  const client = getDiscordClient()

  if (!client) {
    return discordReply(`Umm... no client found. This is bad.`, "error")
  }

  const dBot = settings.discord_bot

  const channels = [
    { name: dBot.movie_channel_name, label: "Movies" },
    { name: dBot.series_channel_name, label: "Series" },
    { name: dBot.music_channel_name, label: "Music" },
    { name: dBot.books_channel_name, label: "Books" },
  ].filter((c) => c.name)

  if (channels.length === 0) {
    return discordReply(
      "There are no selected channels for content commands. Please contact the server owner.",
      "error",
      "There are no selected channels for content commands.",
    )
  }

  if (!channels.some((c) => c.name === channel.name)) {
    const suggestions = channels.map((c) => {
      // Find channel with type guard
      const channelObj = client.channels.cache.find((ch) => isTextChannel(ch) && ch.name === c.name)
      const mention = channelObj ? `<#${channelObj.id}>` : c.name
      return `${mention} for ${c.label}`
    })

    let suggestionStr = ""
    if (suggestions.length === 1) {
      suggestionStr = suggestions[0]
    } else if (suggestions.length === 2) {
      suggestionStr = suggestions.join(" or ")
    } else {
      suggestionStr =
        suggestions.slice(0, -1).join(", ") + " and " + suggestions[suggestions.length - 1]
    }

    return `I'm sorry. You can't use the ${channel} channel for this command. Try ${suggestionStr}.`
  }

  return ""
}
