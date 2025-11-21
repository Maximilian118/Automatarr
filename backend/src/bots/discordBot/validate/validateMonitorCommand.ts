import { Message, TextBasedChannel } from "discord.js"
import { settingsDocType } from "../../../models/settings"
import { MonitorOptions } from "../../../types/seriesTypes"
import { channelValid, validateTitleAndYear } from "./validationUtility"

// Validate the !monitor command
export const validateMonitorCommand = async (
  message: Message,
  settings: settingsDocType,
): Promise<
  | string
  | {
      channel: TextBasedChannel
      command: string
      title: string
      year: string
      searchString: string
      newMonitor: MonitorOptions
    }
> => {
  // Check if an accepted channel has been used
  const validChannel = channelValid(message.channel, settings)
  if (typeof validChannel === "string") return validChannel

  const { channel, contentType } = validChannel

  // Only allow for series
  if (contentType !== "series") {
    return "The !monitor command only works for series. Please use it in the series channel."
  }

  const msgArr = message.content.trim().split(/\s+/)

  if (msgArr.length < 3) {
    return "The !monitor command must contain a series title, year, and monitor option.\nFor example: !monitor Breaking Bad 2008 firstSeason"
  }

  const [command, ...rest] = msgArr

  if (command.toLowerCase() !== "!monitor") {
    return `Invalid command \`${command}\`.`
  }

  // Use existing validateTitleAndYear to parse title, year, and monitor
  const validated = await validateTitleAndYear(rest, "series", settings, undefined, true)
  if (typeof validated === "string") return validated

  return {
    channel,
    command,
    title: validated.title,
    year: validated.year,
    searchString: validated.searchString,
    newMonitor: validated.monitor,
  }
}
