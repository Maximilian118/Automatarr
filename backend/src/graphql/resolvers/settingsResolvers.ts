import logger from "../../logger"
import Settings, { settingsType } from "../../models/settings"

const settingsResolvers = {
  newSettings: async (): Promise<settingsType> => {
    // Check if a settings object already exists
    const settings = await Settings.findOne()

    // Return settings object if it already exists
    if (settings) {
      logger.info("newSettings: Found settings object.")
      return settings
    }

    // Create a new settings object
    const newSettings = new Settings({}, (err: string) => {
      if (err) {
        logger.error("newSettings: Could not create new Settings.")
        throw new Error(err)
      }
    })

    // Push settings object to the database
    await newSettings.save()
    logger.info("newSettings: New settings object created.")

    return newSettings._doc
  },
  updateSettings: async (args: { settingsInput: settingsType }): Promise<settingsType> => {
    const {
      _id,
      radarr_URL,
      radarr_KEY,
      sonarr_URL,
      sonarr_KEY,
      lidarr_URL,
      lidarr_KEY,
      import_blocked,
      wanted_missing,
      import_blocked_loop,
      wanted_missing_loop,
      qBittorrent_URL,
    } = args.settingsInput

    // Find settings object by ID
    const settings = await Settings.findById(_id)

    // Throw error if no object was found
    if (!settings) {
      logger.error("updateSettings: No settings by that ID were found.")
      throw new Error("No settings by that ID were found.")
    }

    // Update all the things
    settings.radarr_URL = radarr_URL
    settings.radarr_KEY = radarr_KEY
    settings.sonarr_URL = sonarr_URL
    settings.sonarr_KEY = sonarr_KEY
    settings.lidarr_URL = lidarr_URL
    settings.lidarr_KEY = lidarr_KEY
    settings.import_blocked = import_blocked
    settings.wanted_missing = wanted_missing
    settings.import_blocked_loop = import_blocked_loop
    settings.wanted_missing_loop = wanted_missing_loop
    settings.qBittorrent_URL = qBittorrent_URL

    // Save the updated object
    await settings.save()

    // Return the updated object
    return settings._doc
  },
  getSettings: async (): Promise<settingsType> => {
    // Find what should be the only settings object in the db
    const settings = await Settings.findOne()

    // Throw error if no object was found
    if (!settings) {
      logger.error("getSettings: No Settings by that ID were found.")
      throw new Error("No settings by that ID were found.")
    }

    // Return the settings object
    return settings._doc
  },
}

export default settingsResolvers
