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
  getAllRootFolders,
} from "../../shared/StarrRequests"
import moment from "moment"
import { getCommandLists } from "../../shared/miscRequests"
import { getqBittorrentData } from "../../shared/qBittorrentRequests"
import { updateNivoCharts } from "../../shared/utility"

const dataResolvers = {
  newData: async (): Promise<dataType> => {
    // Check if a data object already exists
    const data = await Data.findOne()

    // Return data object if it already exists
    if (data) {
      logger.info("Found existing data object in database.")
      return data
    }

    // Create new data object
    const newData = new Data({}, (err: string) => {
      if (err) {
        logger.error("newData: Could not create new data object.")
        throw new Error(err)
      }
    })

    // Push data object to the database
    await newData.save()
    logger.info("New data object created.")

    return newData
  },
  updateData: async (newSettings?: settingsDocType): Promise<dataType | undefined> => {
    // Get latest settings
    // prettier-ignore
    const settings = newSettings ? newSettings : (await Settings.findOne()) as unknown as settingsDocType

    if (!settings) {
      logger.error("updateData: No Settings object were found.")
      return
    }

    // Only get data for active APIs
    const { activeAPIs, data } = await activeAPIsArr(settings._doc)

    // If there are no command lists, return. Don't want to erase what's in the db.
    if (activeAPIs.length === 0) {
      logger.error("updateData: No active API's. What are you even doing here? (╯°□°)╯︵ ┻━┻")
      return
    }

    // Loop through all of the activeAPIs and return all of the possible commands for the Starr apps command endpoint
    const commandList = await getCommandLists(activeAPIs, data)

    // Starr apps
    data.commands = await getAllCommands(activeAPIs, data)
    data.commandList = commandList.length === 0 ? data.commandList : commandList // If commandList is empty, do not remove the commands currently in db
    data.downloadQueues = await getAllDownloadQueues(activeAPIs, data)
    data.importLists = await getAllImportLists(activeAPIs, data)
    data.rootFolders = await getAllRootFolders(activeAPIs, data)
    data.missingWanteds = await getAllMissingwanted(activeAPIs, data)
    data.libraries = await getAllLibraries(activeAPIs, data) // Only makes requests one per hour per API

    // qBittorrent
    data.qBittorrent = await getqBittorrentData(settings._doc, data)

    // Nivo charts
    data.nivoCharts = await updateNivoCharts(activeAPIs, data)

    data.updated_at = moment().format()
    return await data.save()
  },
  getData: async (): Promise<dataType | undefined> => {
    // Retreive the data object from the db
    const data = (await Data.findOne()) as dataDocType

    if (!data) {
      logger.error("getData: Could not find data object in db.")
      return
    }

    return data._doc
  },
  updateNivoCharts: async (): Promise<undefined> => {
    // Get latest settings
    const settings = (await Settings.findOne()) as settingsDocType

    if (!settings) {
      logger.error("updateData: No Settings object were found.")
      return
    }

    // Only get data for active APIs
    const { activeAPIs, data } = await activeAPIsArr(settings._doc)

    // Nivo charts
    data.nivoCharts = await updateNivoCharts(activeAPIs, data)

    data.updated_at = moment().format()
    await data.save()
  },
}

export default dataResolvers
