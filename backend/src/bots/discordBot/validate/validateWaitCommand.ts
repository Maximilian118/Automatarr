import { Message, TextBasedChannel } from "discord.js"
import { settingsDocType } from "../../../models/settings"
import { dataDocType } from "../../../models/data"
import { channelValid, validateTitleAndYear } from "./validationUtility"

// Validate the array data for the wait time command
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
