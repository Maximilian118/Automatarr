import { settingsType } from "../models/settings"
import { activeAPIsArr } from "../shared/activeAPIsArr"
import { commandData } from "../types/types"
import logger from "../logger"
import { searchMissing } from "../shared/StarrRequests"

const search_wanted_missing = async (settings: settingsType): Promise<void> => {
  // Only get data for API's that have been checked and are active
  const { activeAPIs } = await activeAPIsArr(settings)
  // Loop through all of the active API's and send the relevant command request to search for wanted missing
  for (const API of activeAPIs) {
    // If this API is already searching, return
    if (API.data.commands) {
      const alreadySearching = (commands: commandData[]) =>
        commands.some((a) => a.name.toLowerCase().startsWith("missing"))

      if (alreadySearching(API.data.commands)) {
        logger.info(`wantedMissing: ${API.name} is already searching.`)
        continue
      }
    }

    // Send the command request
    // prettier-ignore
    await searchMissing(API.data.commandList, API.name, API.data.URL, API.data.API_version, API.data.KEY)
  }
}

export default search_wanted_missing
