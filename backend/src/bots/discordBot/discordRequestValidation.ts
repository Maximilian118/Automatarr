import { settingsDocType } from "../../models/settings"
import { Message, TextBasedChannel } from "discord.js"
import { matchedUser } from "./discordBotUtility"
import { extractSeasonEpisode } from "../../shared/qBittorrentUtility"
import { dataDocType } from "../../models/data"
import { Movie } from "../../types/movieTypes"
import { Series } from "../../types/seriesTypes"
import { channelValid, validateTitleAndYear } from "./discordBotRequestValidationUtility"

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
    return "The !list command must contain no more than three parts: `!list <optional_contentType> <optional_discord_username>`."
  }

  const [command, contentType] = msgArr

  if (command.toLowerCase() !== "!list") {
    return `Invalid command \`${command}\`.`
  }

  if (!contentType) {
    return ""
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
  message: Message,
  settings: settingsDocType,
  API: "Radarr" | "Sonarr",
): Promise<
  | string
  | {
      channel: TextBasedChannel
      command: string
      title: string
      year: string
      searchString: string
    }
> => {
  // Check if an accepted channel has been used
  const validChannel = channelValid(message.channel, settings)
  if (typeof validChannel === "string") return validChannel

  const { channel, contentType } = validChannel

  const msgArr = message.content.trim().split(/\s+/)
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

  const validated = await validateTitleAndYear(rest, contentType, settings)
  if (typeof validated === "string") return validated

  return {
    ...validated,
    channel,
    command,
  }
}

// Validate the array data for the caseRemove message
export const validateRemoveCommand = async (
  message: Message,
  settings: settingsDocType,
): Promise<
  | string
  | {
      channel: TextBasedChannel
      command: string
      passedIndex: number | null
      poolItemTitle: string
      contentTitle: string | null
      contentYear: number | null
      contentType: "movie" | "series"
    }
> => {
  const contentTypes = ["movie", "movies", "series"]
  const unsupported = ["album", "albums", "book", "books"]

  // Check if an accepted channel has been used
  const validChannel = channelValid(message.channel, settings)
  if (typeof validChannel === "string") return validChannel

  const { channel, contentType } = validChannel

  const msgArr = message.content.trim().split(/\s+/)

  const [command, ...rest] = msgArr

  if (command.toLowerCase() !== "!remove") {
    return `Invalid command \`${command}\`.`
  }

  if (msgArr.length < 2) {
    return `The ${command} command must contain a ${contentType} title and a 4-digit year. For example: ${command} ${
      contentType === "movie" ? "Top Gun 1986" : "Breaking Bad 2008"
    }`
  }

  const typeLower = contentType.toLowerCase()
  const singular = typeLower.includes("movie") ? "movie" : "series"
  const plural = singular === "movie" ? "movies" : "series"

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

  const user = matchedUser(settings, message.author.username)
  if (!user) return `A Discord user by ${message.author.username} does not exist in the database.`

  const contentArr = singular === "movie" ? user.pool.movies : user.pool.series
  if (contentArr.length === 0) return `You have no ${plural} to remove, ${user.name}!`

  const potentialIndex = Number(rest[0])
  const isIntegerInput = Number.isInteger(potentialIndex)

  const canRemove =
    `You can remove a ${singular} by passing the index or the full title + year:\n` +
    contentArr.map((m, i) => `${i + 1}. ${m.title} ${m.year}`).join("\n")

  if (isIntegerInput) {
    if (potentialIndex === 0) {
      return `Index 0 is invalid. Indexing starts at 1. Use \`!remove ${singular} 1\` for the first ${singular}.`
    }

    if (potentialIndex < 0) {
      return `Negative indices are not valid. Use an index from 1 to ${contentArr.length}.`
    }

    const adjustedIndex = potentialIndex - 1

    if (adjustedIndex >= contentArr.length) {
      return `Index out of range. You only have ${contentArr.length} ${plural}, indexed from 1 to ${contentArr.length}.\n\n${canRemove}`
    }

    const item = contentArr[adjustedIndex]
    const poolItemTitle = `${item.title} ${item.year}`

    return {
      channel,
      command,
      passedIndex: adjustedIndex + 1,
      poolItemTitle,
      contentTitle: item.title,
      contentYear: item.year,
      contentType: singular,
    }
  }

  // Fallback: treat as title + 4-digit year
  const lastPart = rest[rest.length - 1]
  const yearMatch = lastPart.match(/^\d{4}$/)

  if (!yearMatch) {
    return `Which ${singular} would you like to remove?\n\n${canRemove}`
  }

  const year = parseInt(lastPart, 10)
  const title = rest.slice(0, -1).join(" ").trim()
  const poolItemTitle = `${title} ${year}`

  return {
    channel,
    command,
    passedIndex: null,
    poolItemTitle,
    contentTitle: title,
    contentYear: year,
    contentType: singular,
  }
}

// Validate the array data for the caseBlocklist message
export const validateBlocklistCommand = async (
  message: Message,
  settings: settingsDocType,
  data: dataDocType,
): Promise<
  | string
  | {
      command: string
      contentType: "movie" | "series"
      title: string
      noMatchMessage: string
      movieDBList: Movie[]
      seriesDBList: Series[]
      year?: number
      seasonNumber?: number
      episodeNumber?: number
    }
> => {
  const validCommands = ["!blocklist", "!dud"]

  // Check if an accepted channel has been used
  const validChannel = channelValid(message.channel, settings)
  if (typeof validChannel === "string") return validChannel

  const { contentType } = validChannel

  const msgArr = message.content.trim().split(/\s+/)

  if (msgArr.length < 2) {
    return "The !blocklist command must contain at least two parts: `!blocklist <movieTitle + Year / seriesTitle SxxEyy>`, e.g. `!blocklist Dune 2021` or `!blocklist The Bear S02E04`."
  }

  const [command, ...rest] = msgArr
  const typeLower = contentType.toLowerCase()
  const singular = typeLower.includes("movie") ? "movie" : "series"

  if (!validCommands.includes(command.toLowerCase())) {
    return `Invalid command \`${command}\`. Use one of these: ${validCommands.join(", ")}.`
  }

  const rawInput = rest.join(" ").trim()
  const cleanedInput = rawInput.replace(/\b(S\d{1,2})\s+(E\d{1,2})\b/i, "$1$2")

  const noMatchMessage = `I can't find anything that matches ${rawInput}.\n${
    singular === "movie"
      ? `For movies, use a year (e.g., "Dune 2021").`
      : `For series, include an episode (e.g., "The Office S02E01" or "The Office Season 2 Episode 1")`
  }.\n\n`

  let suggestions: (Movie | Series)[] = []
  const movieDBList = (data.libraries.find((api) => api.name === "Radarr")?.data as Movie[]) || []
  const seriesDBList = (data.libraries.find((api) => api.name === "Sonarr")?.data as Series[]) || []

  // Check for season/episode pattern (e.g., S01E02, Season 1 Episode 2, etc.)
  const seasonEpisode = extractSeasonEpisode(cleanedInput)

  if (seasonEpisode) {
    const title = cleanedInput
      .replace(/s(\d{1,2})e(\d{1,2})/i, "")
      .replace(/season[\s]?(\d{1,2})[\s_-]*episode[\s]?(\d{1,2})/i, "")
      .trim()

    return {
      command,
      contentType: "series",
      title,
      movieDBList,
      seriesDBList,
      noMatchMessage,
      seasonNumber: seasonEpisode.season,
      episodeNumber: seasonEpisode.episode,
    }
  }

  if (singular === "movie") {
    // Check for movie title + 4-digit year
    const parts = rawInput.split(" ")
    const last = parts[parts.length - 1]
    const yearMatch = last.match(/^\d{4}$/)

    if (yearMatch) {
      const year = parseInt(last, 10)
      const title = parts.slice(0, -1).join(" ").trim()
      return {
        command,
        contentType: "movie",
        title,
        movieDBList,
        seriesDBList,
        noMatchMessage,
        year,
      }
    }
  }

  const likelyTitle = rawInput
    .replace(/\bseason[\s]?(\d{1,2})[\s_-]*episode[\s]?(\d{1,2})\b/i, "") // Remove season episode
    .replace(/\bs(\d{1,2})e(\d{1,2})\b/i, "") // Remove s**e**
    .replace(/\b\d{4}\b/, "") // Remove 4-digit year
    .trim()
    .toLowerCase()

  if (singular === "movie") {
    suggestions = movieDBList.filter((m) => m.title.toLowerCase().includes(likelyTitle))
  } else {
    suggestions = seriesDBList.filter((s) => s.title.toLowerCase().includes(likelyTitle))
  }

  const suggestionStrings =
    suggestions.length > 0
      ? suggestions
          .flatMap((s, i) => {
            if (singular === "movie") {
              const movie = s as Movie
              return [`${i}. ${movie.title} ${movie.year}`]
            } else {
              const series = s as Series
              const seriesTitle = series.title
              const output: string[] = []

              series.seasons
                ?.filter((season) => season.seasonNumber > 0)
                .forEach((season) => {
                  const seasonNumber = season.seasonNumber.toString().padStart(2, "0")
                  const epCount = season.statistics?.episodeFileCount || "?"
                  output.push(`${i}. ${seriesTitle} S${seasonNumber} E1-${epCount}`)
                })

              return output
            }
          })
          .join("\n")
      : false

  return (
    noMatchMessage + (suggestionStrings ? `Did you mean any of these?\n` + suggestionStrings : "")
  )
}

// Validate the array data for the caseInit message
export const validateWaitCommand = async (
  message: Message,
  settings: settingsDocType,
  data: dataDocType,
): Promise<
  | string
  | {
      channel: TextBasedChannel
      command: string
      title: string
      year: string
      searchString: string
    }
> => {
  // Check if an accepted channel has been used
  const validChannel = channelValid(message.channel, settings)
  if (typeof validChannel === "string") return validChannel

  const { channel, contentType } = validChannel

  const msgArr = message.content.trim().split(/\s+/)

  const [command, ...rest] = msgArr

  const validCommands = ["!waittime", "!wait"]
  if (!validCommands.includes(command.toLowerCase())) {
    return `Invalid command \`${command}\`. Use one of these: ${validCommands.join(", ")}.`
  }

  if (msgArr.length < 2) {
    return `The ${command} command must contain a ${contentType} title and a 4-digit year. For example: ${command} ${
      contentType === "movie" ? "Top Gun 1986" : "Breaking Bad 2008"
    }`
  }

  const validated = await validateTitleAndYear(rest, contentType, settings, data)
  if (typeof validated === "string") return validated

  return {
    ...validated,
    channel,
    command,
  }
}

// Validate the array data for the caseInit message
export const validateStayCommand = async (
  message: Message,
  settings: settingsDocType,
  data: dataDocType,
): Promise<
  | string
  | {
      channel: TextBasedChannel
      command: string
      title: string
      year: string
      searchString: string
    }
> => {
  // Check if an accepted channel has been used
  const validChannel = channelValid(message.channel, settings)
  if (typeof validChannel === "string") return validChannel

  const { channel, contentType } = validChannel

  const msgArr = message.content.trim().split(/\s+/)

  const [command, ...rest] = msgArr

  if (command.toLowerCase() !== "!stay") {
    return `Invalid command \`${command}\`.`
  }

  if (msgArr.length < 2) {
    return `The ${command} command must contain a ${contentType} title and a 4-digit year. For example: ${command} ${
      contentType === "movie" ? "Top Gun 1986" : "Breaking Bad 2008"
    }`
  }

  const validated = await validateTitleAndYear(rest, contentType, settings, data)
  if (typeof validated === "string") return validated

  return {
    ...validated,
    channel,
    command,
  }
}
