import { Message, TextBasedChannel } from "discord.js"
import { settingsDocType } from "../../../models/settings"
import { channelValid } from "./validationUtility"

// Validate the array data for the caseSearch message
export const validateSearchCommand = async (
  message: Message,
  settings: settingsDocType,
): Promise<
  | string
  | {
      channel: TextBasedChannel
      command: string
      searchTerm: string
      year?: number
    }
> => {
  // Check if an accepted channel has been used
  const validChannel = channelValid(message.channel, settings)
  if (typeof validChannel === "string") return validChannel

  const { channel, contentType } = validChannel

  const msgArr = message.content.trim().split(/\s+/)

  if (msgArr.length < 2) {
    return `The !search command must contain a ${contentType} title. For example: !search ${
      contentType === "movie" ? "Top Gun" : "Breaking Bad"
    } or !search ${contentType === "movie" ? "Top Gun 1986" : "Breaking Bad 2008"}`
  }

  const [command, ...rest] = msgArr

  if (command.toLowerCase() !== "!search") {
    return `Invalid command \`${command}\`.`
  }

  // Check if the last part is a 4-digit year
  const lastPart = rest[rest.length - 1]
  const yearMatch = lastPart.match(/^\\d{4}$/)

  let searchTerm: string
  let year: number | undefined

  if (yearMatch) {
    year = parseInt(lastPart, 10)
    searchTerm = rest.slice(0, -1).join(" ").trim().toLowerCase()
  } else {
    searchTerm = rest.join(" ").trim().toLowerCase()
  }

  if (!searchTerm) {
    return `Please provide a ${contentType} title to search for.`
  }

  return {
    channel,
    command,
    searchTerm,
    year,
  }
}
