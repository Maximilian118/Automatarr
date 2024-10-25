// import axios from "axios"
import axios from "axios"
import logger from "../../logger"
import { settingsType } from "../../models/settings"
import { activeAPIsArr, cleanUrl } from "../../shared/utility"

const coreResolvers = {
  search_wanted_missing: async (settings: settingsType): Promise<void> => {
    // Only get data for API's that have been checked and are active
    const activeAPIs = await activeAPIsArr(settings)
    // Loop through all of the active API's and send the relevant command request to search for wanted missing
    activeAPIs.forEach(async (c) => {
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
}

export default coreResolvers
