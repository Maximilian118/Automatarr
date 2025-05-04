import { settingsDocType } from "../models/settings"
import { discordBot } from "./discordBot"
import logger from "../logger"

// Check if any keys in settings that include "bot" have changed
const botKeysChanged = (settings: settingsDocType, oldSettings: settingsDocType): boolean => {
  for (const key in oldSettings) {
    if (key.includes("bot") && oldSettings[key] !== settings[key]) {
      return true
    }
  }

  return false
}

// If Bot settings have changed, run all Bot functions with new settings.
// Return updated settings from all Bot functions.
export const botsControl = async (
  settings: settingsDocType,
  oldSettings?: settingsDocType,
): Promise<settingsDocType> => {
  // If Bot settings have not changed, return.
  if (oldSettings && !botKeysChanged(settings, oldSettings)) {
    logger.info("Bots | No Changes.")
    return settings
  }

  // Init new settings object for mutation
  let newSettings: settingsDocType = settings

  // Call all bot functions and mutate settings accordingly
  newSettings = await discordBot(settings)

  return newSettings
}
