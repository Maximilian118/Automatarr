import axios from "axios"
import logger from "../../logger"
import { settingsType } from "../../models/settings"
import { activeAPIsArr, cleanUrl, getQueueItem } from "../../shared/utility"
import Data from "../../models/data"
import { commandData } from "../../types"

const coreResolvers = {
  search_wanted_missing: async (settings: settingsType): Promise<void> => {
    // Only get data for API's that have been checked and are active
    const activeAPIs = await activeAPIsArr(settings)
    // Loop through all of the active API's and send the relevant command request to search for wanted missing
    activeAPIs.forEach(async (c) => {
      if (c.data.commands) {
        const alreadySearching = (commands: commandData[]) =>
          commands.some((c) => c.name.toLowerCase().startsWith("missing"))

        if (alreadySearching(c.data.commands)) {
          logger.info(`search_wanted_missing: ${c.name} is already searching.`)
          return
        }
      }

      // We require the commands list for this API for this resolver
      if (!c.data.commandList) {
        logger.warn(`search_wanted_missing: No commands could be found for ${c.name}`)
        return
      }
      // Retrieve the first string that matches startsWith('missing')
      const missingSearchString = (arr: string[]) =>
        arr.find((str) => str.toLowerCase().startsWith("missing"))
      // If no string is found, return.
      if (!missingSearchString(c.data.commandList)) {
        logger.warn("search_wanted_missing: Could not retrieve search command.")
        return
      }
      // Send the command to search for missing content
      try {
        await axios.post(
          cleanUrl(`${c.data.URL}/api/${c.data.API_version}/command?apikey=${c.data.KEY}`),
          {
            name: missingSearchString(c.data.commandList),
          },
          {
            headers: {
              "Content-Type": "application/json",
            },
          },
        )

        logger.info(`search_wanted_missing: ${c.name} search started.`)
      } catch (err) {
        logger.error(`search_wanted_missing: ${c.name} error: ${err}.`)
      }
    })
  },
  import_blocked_handler: async (settings: settingsType): Promise<void> => {
    // Only get data for API's that have been checked and are active
    const activeAPIs = await activeAPIsArr(settings)
    // Loop through all of the active API's
    for (const API of activeAPIs) {
      // Create a downloadQueue object and retrieve the latest queue data
      const queueItem = await getQueueItem(API)

      if (!queueItem) {
        logger.error(`import_blocked_handler: ${API.name} download queue could not be retrieved.`)
        continue
      }

      // Retrieve the data object from the db
      const data = await Data.findOne()

      if (!data) {
        logger.error("import_blocked_handler: Could not find data object in db.")
        continue
      }

      // Find the matching API download queue and update it
      data.downloadQueues = data.downloadQueues.map((item) =>
        item.name === queueItem.name ? queueItem : item,
      )

      // If there is no matching API download queue, add it
      if (!data.downloadQueues.some((item) => item.name === queueItem.name)) {
        data.downloadQueues.push(queueItem)
      }

      await data.save()
    }
  },
}

export default coreResolvers
