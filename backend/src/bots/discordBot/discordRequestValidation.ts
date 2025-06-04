import { settingsDocType } from "../../models/settings"
import { Channel, GuildTextBasedChannel } from "discord.js"
import { getDiscordClient } from "./discordBot"
import { discordReply } from "./discordBotUtility"
import { searchRadarr } from "../../shared/RadarrStarrRequests"
import { searchSonarr } from "../../shared/SonarrStarrRequests"

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

// Validate the array data for the caseMax message
export const validateMaxCommand = (msgArr: string[]): string => {
  const validCommands = ["!maximum", "!max"]
  const contentTypes = ["movie", "movies", "series"]
  const unsupported = ["album", "albums", "book", "books"]

  if (msgArr.length !== 4) {
    return "The !maximum command must contain exactly four parts: `!maximum <contentType> <amount> <discord_username>`."
  }

  const [command, contentType, amount] = msgArr

  if (!validCommands.includes(command.toLowerCase())) {
    return `Invalid command \`${command}\`. Use one of these: ${validCommands.join(", ")}.`
  }

  if (unsupported.includes(contentType.toLowerCase())) {
    return `I do apologise. My maker hasn't programmed me for ${
      contentType.endsWith("s") ? contentType : contentType + "s"
    } yet.`
  }

  if (!contentTypes.includes(contentType.toLowerCase())) {
    return `Hmm.. I don't understand what you mean by ${contentType}. Try ${contentTypes.join(
      ", ",
    )}.`
  }

  const normalizedAmount = amount.toLowerCase()
  if (normalizedAmount !== "null" && !/^\d+$/.test(normalizedAmount)) {
    return "The 3rd <amount> argument must be a whole number or the word `null` to clear the limit."
  }

  return ""
}

// Validate the array data for the caseMax message
export const validateListCommand = (msgArr: string[]): string => {
  const contentTypes = ["pool", "movie", "movies", "series"]
  const unsupported = ["album", "albums", "book", "books"]

  if (msgArr.length > 3) {
    return "The !list command must contain no more than three parts: `!list <contentType> <optional_discord_username>`."
  }

  const [command, contentType] = msgArr

  if (command.toLowerCase() !== "!list") {
    return `Invalid command \`${command}\`.`
  }

  if (!contentType) {
    return "Please specify a content type: `pool / movie / series."
  }

  const typeLower = contentType.toLowerCase()

  if (unsupported.includes(typeLower)) {
    return `I do apologise. My maker hasn't programmed me for ${
      contentType.endsWith("s") ? contentType : contentType + "s"
    } yet.`
  }

  if (!contentTypes.includes(typeLower)) {
    return `Hmm.. I don't understand what you mean by ${contentType}. Try ${contentTypes.join(
      ", ",
    )}.`
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

// Validate the array data for the caseDeleteUser message
export const validateDeleteUserCommand = (msgArr: string[]): string => {
  if (msgArr.length !== 2) {
    return "The !deleteuser command must contain exactly two parts: `!deleteuser <discord_username>`."
  }

  const [command] = msgArr

  if (command.toLowerCase() !== "!deleteuser") {
    return `Invalid command \`${command}\`.`
  }

  return ""
}

// Validate the array data for the caseRemoveUser message
export const validateRemoveUserCommand = (msgArr: string[]): string => {
  if (msgArr.length !== 2) {
    return "The !removeuser command must contain exactly two parts: `!removeuser <discord_username>`."
  }

  const [command] = msgArr

  if (command.toLowerCase() !== "!removeuser") {
    return `Invalid command \`${command}\`.`
  }

  return ""
}

// Validate the array data for the caseStats message
export const validateCaseStats = (msgArr: string[]): string => {
  if (msgArr.length > 2) {
    return "The !stats command must contain no more than two parts: `!stats <optional_discord_username>`. If you'd like your own stats, simply type `!stats`."
  }

  const [command] = msgArr

  if (command.toLowerCase() !== "!stats") {
    return `Invalid command \`${command}\`.`
  }

  return ""
}

// Validate the array data for the caseInit message
export const validateDownload = async (
  msgContent: string,
  settings: settingsDocType,
  API: "Radarr" | "Sonarr",
): Promise<
  | string
  | {
      command: string
      title: string
      year: string
      searchString: string
    }
> => {
  const msgArr = msgContent.trim().split(/\s+/)
  const content = API === "Radarr" ? "movie" : "series"

  if (msgArr.length < 2) {
    return `The !download command must contain a ${content} title and a 4-digit year. For example: !download ${
      content === "movie" ? "Top Gun 1986" : "Breaking Bad 2008"
    }`
  }

  const [command, ...rest] = msgArr

  if (command.toLowerCase() !== "!download") {
    return `Invalid command \`${command}\`.`
  }

  const yearCandidate = rest[rest.length - 1]
  const yearMatch = yearCandidate.match(/^\d{4}$/)

  if (!yearMatch) {
    // See what returns from the API for examples
    const searchString = rest.join(" ") // all words after !download, including possibly invalid year
    // TMDB-safe title validation (basic ASCII + common punctuation)
    const invalidCharMatch = searchString.match(/[^a-zA-Z0-9 ':,\-&.]/)

    if (invalidCharMatch) {
      return `The ${content} title contains unsupported characters: \`${invalidCharMatch[0]}\``
    }

    const foundContentArr =
      API === "Radarr"
        ? await searchRadarr(settings, searchString)
        : await searchSonarr(settings, searchString)

    return (
      `The last part of the command must be a 4 digit year. ⚠️\n` +
      (foundContentArr && foundContentArr.length
        ? `Is it any of these you wanted? ⛏️\n\n` +
          foundContentArr
            .slice(0, 10)
            .map((c) => `${c.title} ${c.year}`)
            .join("\n")
        : "")
    )
  }

  const year = yearCandidate
  const title = rest.slice(0, -1).join(" ")

  // TMDB-safe title validation (basic ASCII + common punctuation)
  const invalidCharMatch = title.match(/[^a-zA-Z0-9 ':,\-&.]/)
  if (invalidCharMatch) {
    return `The ${content} title contains unsupported characters: \`${invalidCharMatch[0]}\``
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
