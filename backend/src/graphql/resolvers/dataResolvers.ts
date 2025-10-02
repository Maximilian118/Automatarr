import Data, { dataDocType, dataType } from "../../models/data"
import Settings, { settingsDocType } from "../../models/settings"
import logger from "../../logger"
import { activeAPIsArr } from "../../shared/activeAPIsArr"
import {
  getAllCommands,
  getAllDownloadQueues,
  getAllImportLists,
  getAllLibraries,
  getAllMissingwanted,
  getAllQualityProfiles,
  getAllRootFolders,
  getAllDiskspaces,
} from "../../shared/StarrRequests"
import moment from "moment"
import { getCommandLists } from "../../shared/miscRequests"
import { getqBittorrentData } from "../../shared/qBittorrentRequests"
import { saveWithRetry } from "../../shared/database"

const dataResolvers = {
  newData: async (): Promise<dataType> => {
    // Check if a data object already exists
    const data = await Data.findOne()

    // Return data object if it already exists
    if (data) {
      logger.success("MongoDB | Found existing data object in database.")
      return data
    }

    // Create new data object
    const newData = new Data({}, (err: string) => {
      if (err) {
        logger.error("MongoDB | Could not create new data object.")
        throw new Error(err)
      }
    })

    // Push data object to the database
    await newData.save()
    logger.success("MongoDB | New data object created.")

    return newData
  },
  getData: async (newSettings?: settingsDocType): Promise<dataDocType | undefined> => {
    // Get latest settings
    // prettier-ignore
    const settings = newSettings ? newSettings : (await Settings.findOne()) as unknown as settingsDocType

    if (!settings) {
      logger.error("checkRadarr: No Settings object was found.")
      return
    }

    // Only get data for active APIs
    const { data, activeAPIs } = await activeAPIsArr(settings._doc)

    // If there are no command lists, return. Don't want to erase what's in the db.
    if (activeAPIs.length === 0) {
      logger.error("getData: No active API's. What are you even doing here? (╯°□°)╯︵ ┻━┻")
      return
    }

    const verboseLogging = settings.verbose_logging

    logger.info(`getData | Starting data retrieval.`)
    // Loop through all of the activeAPIs and return all of the possible commands for the Starr apps command endpoint
    const commandList = await getCommandLists(activeAPIs, data)
    // Starr Apps
    data.commands = await getAllCommands(activeAPIs, data, verboseLogging)
    data.commandList = commandList.length === 0 ? data.commandList : commandList // If commandList is empty, do not remove the commands currently in db
    data.downloadQueues = await getAllDownloadQueues(activeAPIs, data, verboseLogging)
    data.importLists = await getAllImportLists(activeAPIs, data, verboseLogging)
    data.rootFolders = await getAllRootFolders(activeAPIs, data, verboseLogging)
    data.diskspaces = await getAllDiskspaces(activeAPIs, data, verboseLogging)
    data.qualityProfiles = await getAllQualityProfiles(activeAPIs, data, verboseLogging)
    data.missingWanteds = await getAllMissingwanted(activeAPIs, data, verboseLogging)
    data.libraries = await getAllLibraries(activeAPIs, data, verboseLogging) // Only makes requests one per hour per API
    // qBittorrent
    data.qBittorrent = await getqBittorrentData(settings._doc, data, verboseLogging)

    data.updated_at = moment().format()
    const savedData = (await saveWithRetry(data, "getData")) as dataDocType

    // Run user_pool_content_checker to sync user pools with fresh library data
    // This ensures user pools are updated before storage_cleaner runs
    if (savedData && settings.user_pool_checker) {
      const { default: user_pool_content_checker } = await import("../../loops/user_pool_content_checker")
      await user_pool_content_checker(settings._doc)
    }

    // Run storage_cleaner immediately after user pool sync
    // Pass the fresh data directly to avoid race conditions with database reads
    if (savedData && settings.storage_cleaner) {
      const { default: storage_cleaner } = await import("../../loops/storage_cleaner")
      await storage_cleaner(settings._doc, savedData)
    }

    return savedData
  },
}

export default dataResolvers
