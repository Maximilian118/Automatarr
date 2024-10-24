// import axios from "axios"
import logger from "../../logger"
import { settingsType } from "../../models/settings"
import { activeAPIsArr } from "../../shared/utility"
import { commandData } from "../../models/data"

const coreResolvers = {
  search_wanted_missing: async (settings: settingsType): Promise<void> => {
    // Only get data for API's that have been checked and are active
    const activeAPIs = await activeAPIsArr(settings)
    // Loop through all of the active API's and send the relevant command request to search for wanted missing
    activeAPIs.forEach(async (c) => {
      // We require the commands list for this API for this resolver
      if (!c.data.commands) {
        logger.warn(`search_wanted_missing: No commands could be found for ${c.name}`)
        return
      }
      // Find the command required to triggure a search for wanted missing content
      const missingSearchString = (cs: commandData[]) => {
        // Find the first occurrence of a name starting with 'missing' (case-insensitive)
        const missingCommand = cs.find((c) => {
          // console.log(c.name.toLowerCase())
          return c.name.toLowerCase().startsWith("missing")
        })
        // If found, return the name; otherwise, return undefined
        return missingCommand ? missingCommand.name : undefined
      }

      if (!missingSearchString(c.data.commands)) {
        logger.warn("search_wanted_missing: Could not retrieve search command.")
        return
      }

      // try {
      //   await axios.post(
      //     cleanUrl(`${c.data.URL}/api/${c.data.API_version}/command?apikey=${c.data.KEY}`),
      //     {
      //       name: c.command,
      //     },
      //     {
      //       headers: {
      //         "Content-Type": "application/json",
      //       },
      //     },
      //   )

      //   logger.info(`search_wanted_missing: ${c.name} search started.`)
      // } catch (err) {
      //   logger.error(`search_wanted_missing: ${c.name} error: ${err}.`)
      // }
    })
  },
}

export default coreResolvers
