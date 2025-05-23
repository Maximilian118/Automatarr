import moment from "moment"
import { botsControl } from "../../bots/botsControl"
import logger from "../../logger"
import Settings, { settingsDocType, settingsType } from "../../models/settings"
import { allLoopsDeactivated, coreFunctionsOnce, coreLoops } from "../../shared/utility"
import Resolvers from "./resolvers"

const settingsResolvers = {
  newSettings: async (): Promise<settingsType> => {
    // Check if a settings object already exists
    const settings = await Settings.findOne()

    // Return settings object if it already exists
    if (settings) {
      logger.success("Found existing settings object in database.")
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
    const createdSettings = (await newSettings.save()) as settingsDocType
    logger.success("New settings object created.")

    return createdSettings
  },
  updateSettings: async (args: { settingsInput: settingsType }): Promise<settingsType> => {
    // Find settings object by ID
    let settings = (await Settings.findById(args.settingsInput._id)) as settingsDocType

    // Throw error if no object was found
    if (!settings) {
      logger.error("updateSettings: No settings by that ID were found.")
      throw new Error("No settings by that ID were found.")
    }

    // Deep clone full Mongoose document before mutation
    const oldSettings = settings.toObject() as settingsType

    // Update all the things
    settings.radarr_URL = args.settingsInput.radarr_URL
    settings.radarr_KEY = args.settingsInput.radarr_KEY
    settings.radarr_API_version = args.settingsInput.radarr_API_version
    settings.radarr_active = args.settingsInput.radarr_active
    settings.sonarr_URL = args.settingsInput.sonarr_URL
    settings.sonarr_KEY = args.settingsInput.sonarr_KEY
    settings.sonarr_API_version = args.settingsInput.sonarr_API_version
    settings.sonarr_active = args.settingsInput.sonarr_active
    settings.lidarr_URL = args.settingsInput.lidarr_URL
    settings.lidarr_KEY = args.settingsInput.lidarr_KEY
    settings.lidarr_API_version = args.settingsInput.lidarr_API_version
    settings.lidarr_active = args.settingsInput.lidarr_active
    settings.import_blocked = args.settingsInput.import_blocked
    settings.wanted_missing = args.settingsInput.wanted_missing
    settings.remove_failed = args.settingsInput.remove_failed
    settings.remove_missing = args.settingsInput.remove_missing
    settings.permissions_change = args.settingsInput.permissions_change
    settings.tidy_directories = args.settingsInput.tidy_directories
    settings.import_blocked_loop = args.settingsInput.import_blocked_loop
    settings.wanted_missing_loop = args.settingsInput.wanted_missing_loop
    settings.remove_failed_loop = args.settingsInput.remove_failed_loop
    settings.remove_missing_loop = args.settingsInput.remove_missing_loop
    settings.remove_missing_level = args.settingsInput.remove_missing_level
    settings.permissions_change_loop = args.settingsInput.permissions_change_loop
    settings.permissions_change_chown = args.settingsInput.permissions_change_chown
    settings.permissions_change_chmod = args.settingsInput.permissions_change_chmod
    settings.tidy_directories_loop = args.settingsInput.tidy_directories_loop
    settings.tidy_directories_paths = args.settingsInput.tidy_directories_paths
    settings.qBittorrent_URL = args.settingsInput.qBittorrent_URL
    settings.qBittorrent_username = args.settingsInput.qBittorrent_username
    settings.qBittorrent_password = args.settingsInput.qBittorrent_password
    settings.qBittorrent_active = args.settingsInput.qBittorrent_active
    settings.qBittorrent_API_version = args.settingsInput.qBittorrent_API_version
    Object.assign(settings.general_bot, args.settingsInput.general_bot)
    Object.assign(settings.discord_bot, args.settingsInput.discord_bot)
    settings.updated_at = moment().format()

    // Update settings as needed with Bot data
    settings = await botsControl(settings, oldSettings)

    // Save the updated object
    await settings.save()

    // Update the data object in the database
    if (!allLoopsDeactivated(settings._doc)) {
      await Resolvers.getData(settings)
    }

    // Call the core loop functions once
    coreFunctionsOnce(settings)
    // Ensure the active loops have been started
    // True = Skip first content execution as we've just called content functions once above
    coreLoops(true)

    // Return the updated object
    return settings._doc
  },
  getSettings: async (): Promise<settingsType> => {
    // Find what should be the only settings object in the db
    const settings = (await Settings.findOne()) as settingsDocType

    // Throw error if no object was found
    if (!settings) {
      logger.error("getSettings: No Settings were found.")
    }

    // Return the settings object
    return settings._doc
  },
}

export default settingsResolvers
