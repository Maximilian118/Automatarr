import { settingsDocType, settingsType } from "../models/settings"
import { discordBot } from "./discordBot/discordBot"
import logger from "../logger"

const deepCompare = (a: any, b: any): boolean => {
  if (a === b) return false

  if (typeof a !== "object" || typeof b !== "object" || a === null || b === null) {
    return a !== b
  }

  const keys = new Set([...Object.keys(a), ...Object.keys(b)])
  for (const key of keys) {
    if (key === "_id") continue
    if (deepCompare(a[key], b[key])) return true
  }

  return false
}

const botKeysChanged = (settings: settingsType, oldSettings: settingsType): boolean => {
  for (const key in oldSettings) {
    if (key.includes("bot")) {
      if (deepCompare(settings[key], oldSettings[key])) {
        return true
      }
    }
  }
  return false
}

// If Bot settings have changed, run all Bot functions with new settings.
// Return updated settings from all Bot functions.
export const botsControl = async (
  settings: settingsDocType,
  oldSettings?: settingsType,
): Promise<settingsDocType> => {
  // If Bot settings have not changed, return settings.
  if (!oldSettings) {
    logger.info("Bots | Initialising.")
  } else if (!botKeysChanged(settings.toObject(), oldSettings)) {
    logger.info("Bots | No changes.")
    return settings
  } else {
    logger.info("Bots | Bot settings changed.")
  }

  // Call all bot functions and mutate settings accordingly
  settings = await discordBot(settings)

  return settings
}
