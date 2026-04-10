import { settingsType } from "../models/settings"
import { activeAPIsArr } from "../shared/activeAPIsArr"
import { commandData } from "../types/types"
import logger from "../logger"
import { searchAllWantedMissing } from "../shared/StarrRequests"
import { shouldSkipLoop, updateLoopData } from "./loopUtility"
import { saveWithRetry } from "../shared/database"

const content_search = async (settings: settingsType): Promise<void> => {
  // Only get data for API's that have been checked and are active
  const { data, activeAPIs } = await activeAPIsArr(settings)

  // If loop exists and has a last_ran timestamp, check how long ago it was
  const { shouldSkip } = shouldSkipLoop("content_search", data, settings.content_search_loop)
  if (shouldSkip) return

  // Loop through all of the active API's and send the relevant command request to search for wanted missing
  for (const API of activeAPIs) {
    // If this API is already searching, return
    if (API.data.commands) {
      const alreadySearching = (commands: commandData[]) =>
        commands.some((a) => a.name.toLowerCase().startsWith("missing"))

      if (alreadySearching(API.data.commands)) {
        logger.info(`Content Search | ${API.name} is already searching.`)
        continue
      }
    }

    // Send the command request
    // prettier-ignore
    await searchAllWantedMissing(API.data.commandList, API.name, API.data.URL, API.data.API_version, API.data.KEY)
  }

  updateLoopData("content_search", data)

  // Save the latest download queue data to the db
  await saveWithRetry(data, "content_search")
}

export default content_search
