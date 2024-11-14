import logger from "../../logger"
import Settings, { settingsType } from "../../models/settings"
import Resolvers from "./resolvers"

const settingsResolvers = {
  newSettings: async (): Promise<settingsType> => {
    // Check if a settings object already exists
    const settings = await Settings.findOne()

    // Return settings object if it already exists
    if (settings) {
      logger.info("Found existing settings object in database.")
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
    logger.info("New settings object created.")

    return newSettings._doc
  },
  updateSettings: async (args: { settingsInput: settingsType }): Promise<settingsType> => {
    const {
      _id,
      radarr_URL,
      radarr_KEY,
      radarr_API_version,
      radarr_active,
      sonarr_URL,
      sonarr_KEY,
      sonarr_API_version,
      sonarr_active,
      lidarr_URL,
      lidarr_KEY,
      lidarr_API_version,
      lidarr_active,
      import_blocked,
      wanted_missing,
      import_blocked_loop,
      wanted_missing_loop,
      qBittorrent_URL,
      qBittorrent_username,
      qBittorrent_password,
      qBittorrent_active,
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
    settings.radarr_API_version = radarr_API_version
    settings.radarr_active = radarr_active
    settings.sonarr_URL = sonarr_URL
    settings.sonarr_KEY = sonarr_KEY
    settings.sonarr_API_version = sonarr_API_version
    settings.sonarr_active = sonarr_active
    settings.lidarr_URL = lidarr_URL
    settings.lidarr_KEY = lidarr_KEY
    settings.lidarr_API_version = lidarr_API_version
    settings.lidarr_active = lidarr_active
    settings.import_blocked = import_blocked
    settings.wanted_missing = wanted_missing
    settings.import_blocked_loop = import_blocked_loop
    settings.wanted_missing_loop = wanted_missing_loop
    settings.qBittorrent_URL = qBittorrent_URL
    settings.qBittorrent_username = qBittorrent_username
    settings.qBittorrent_password = qBittorrent_password
    settings.qBittorrent_active = qBittorrent_active

    // Save the updated object
    await settings.save()

    // Update the data object in the database
    await Resolvers.getData(settings)

    // Call the core loop functions once with the new settings
    if (settings.wanted_missing) {
      await Resolvers.search_wanted_missing(settings._doc)
    }

    if (settings.import_blocked) {
      await Resolvers.import_blocked_handler(settings._doc)
    }

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
