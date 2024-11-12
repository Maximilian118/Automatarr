import Data, { commandList, commandsData, dataType } from "../../models/data"
import { cleanUrl } from "../../shared/utility"
import Settings, { settingsType } from "../../models/settings"
import logger from "../../logger"
import axios from "axios"
import { commandData } from "../../types/types"
import { activeAPIsArr } from "../../shared/activeAPIsArr"
import {
  getAllLibraries,
  getAllMissingwanted,
  getAllRootFolders,
  scrapeCommandsFromURL,
} from "../../shared/StarrRequests"
import moment from "moment"

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
  getData: async (): Promise<dataType | undefined> => {
    // Get latest settings
    const settings = (await Settings.findOne()) as unknown as settingsType

    if (!settings) {
      logger.error("checkRadarr: No Settings object were found.")
      return
    }

    // Only get data for active APIs
    const activeAPIs = await activeAPIsArr(settings._doc)

    // If there are no command lists, return. Don't want to erase what's in the db.
    if (activeAPIs.length === 0) {
      logger.error("getData: No active API's. What are you even doing here? (╯°□°)╯︵ ┻━┻")
      return
    }

    // Loop through all of the activeAPIs and return all of the latest commands
    const commands: commandsData[] = await Promise.all(
      activeAPIs.map(async (API) => {
        try {
          const res = await axios.get(
            cleanUrl(`${API.data.URL}/api/${API.data.API_version}/command?apikey=${API.data.KEY}`),
          )

          return { name: API.name, data: res.data as commandData[] }
        } catch (err) {
          logger.error(`getData: Could not retrieve commands from ${API.name}: ${err}.`)
          return { name: API.name, data: [] as commandData[] }
        }
      }),
    )

    // If there are no current commands, return. We shouldn't have made it this far anyway!
    if (commands.length === 0) {
      logger.error("getData: No latest commands could be found for any API. Blimey!")
    }

    // Loop through all of the activeAPIs and return all of the latest commands
    const commandList: commandList[] = await Promise.all(
      activeAPIs.map(async (API) => {
        return {
          name: API.name,
          data: await scrapeCommandsFromURL(API.name),
        }
      }),
    )

    // If there are no available commands, return. We shouldn't have made it this far anyway!
    if (commandList.length === 0) {
      logger.error("getData: No available commands could be found for any API. Blimey!")
    }

    // Retreive the data object from the db
    const data = await Data.findOne()

    if (!data) {
      logger.error("getData: Could not find data object in db.")
      return
    }

    data.commands = commands
    data.commandList = commandList.length === 0 ? data.commandList : commandList
    data.rootFolders = await getAllRootFolders(activeAPIs)
    data.missingWanteds = await getAllMissingwanted(activeAPIs)
    data.libraries = await getAllLibraries(data, activeAPIs)

    // As getAllLibraries is very heavy, let's not send those requests on every getData execution.
    // Check if an hour has passed since that last getAllLibraries call.
    const hours = 1
    const timeLeft = moment().diff(moment(data.updated_at), "hours")

    if (timeLeft >= hours) {
      data.libraries = await getAllLibraries(data, activeAPIs)
    }

    data.updated_at = moment().format()
    return await data.save()
  },
}

export default dataResolvers
