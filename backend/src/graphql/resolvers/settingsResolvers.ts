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

    const newSettings = new Settings({}, (err: string) => {
      if (err) {
        logger.error("newSettings: Could not create new Settings.")
        throw new Error(err)
      }
    })

    await newSettings.save()
    logger.info("newSettings: New settings object created.")

    return newSettings._doc
  },
  updateSettings: async (args: { settingsInput: settingsType }): Promise<settingsType> => {
    const {
      _id,
      Radarr_URL,
      Radarr_KEY,
      Sonarr_URL,
      Sonarr_KEY,
      Lidarr_URL,
      Lidarr_KEY,
      Import_Blocked,
      Wanted_Missing,
      Import_Blocked_Loop,
      Wanted_Missing_Loop,
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
    settings.Radarr_URL = Radarr_URL
    settings.Radarr_KEY = Radarr_KEY
    settings.Sonarr_URL = Sonarr_URL
    settings.Sonarr_KEY = Sonarr_KEY
    settings.Lidarr_URL = Lidarr_URL
    settings.Lidarr_KEY = Lidarr_KEY
    settings.Import_Blocked = Import_Blocked
    settings.Wanted_Missing = Wanted_Missing
    settings.Import_Blocked_Loop = Import_Blocked_Loop
    settings.Wanted_Missing_Loop = Wanted_Missing_Loop
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
