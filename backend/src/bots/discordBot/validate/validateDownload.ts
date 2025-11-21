import { Message, TextBasedChannel } from "discord.js"
import { settingsDocType } from "../../../models/settings"
import { MonitorOptions } from "../../../types/seriesTypes"
import { channelValid, validateTitleAndYear } from "./validationUtility"

// Validate the array data for the download message
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
      monitor: MonitorOptions
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
