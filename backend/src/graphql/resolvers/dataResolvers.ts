import Data, { commandData, commandsData, dataType } from "../../models/data"
import { activeAPIsArr, cleanUrl } from "../../shared/utility"
import Settings, { settingsType } from "../../models/settings"
import logger from "../../logger"
import axios from "axios"

const dataResolvers = {
  newData: async (): Promise<dataType> => {
    // Check if a data object already exists
    const data = await Data.findOne()

    // Return data object if it already exists
    if (data) {
      logger.info("newData: Found data object.")
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
    logger.info("newData: New data object created.")

    return newData._doc
  },
  getData: async (): Promise<dataType | void> => {
    // Get latest settings
    const settings = (await Settings.findOne()) as unknown as settingsType

    if (!settings) {
      logger.error("checkRadarr: No Settings object were found.")
      return
    }

    // Only get data for active APIs
    const activeAPIs = await activeAPIsArr(settings._doc)

    // Loop through all of the activeAPIs and return all of the possible commands
    const commandLists: commandsData[] = await Promise.all(
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

    // If there are no command lists, return. We shouldn't have made it this far anyway!
    if (commandLists.length === 0) {
      logger.error("getData: No commands could be found for any API. Blimey!")
      return
    }

    // Retreive the data object from the db
    const data = await Data.findOne()

    if (!data) {
      logger.error("getData: Could not find data object in db.")
      return
    }

    data.commands = commandLists

    const newData = await data.save()

    return newData
  },
}

export default dataResolvers
