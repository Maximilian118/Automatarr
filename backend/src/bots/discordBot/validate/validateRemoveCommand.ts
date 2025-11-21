import { Message, TextBasedChannel } from "discord.js"
import { settingsDocType } from "../../../models/settings"
import { matchedUser } from "../discordBotUtility"
import { channelValid } from "./validationUtility"

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
