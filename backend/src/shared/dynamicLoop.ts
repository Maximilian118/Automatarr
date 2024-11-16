import Resolvers from "../graphql/resolvers/resolvers"
import logger from "../logger"
import { settingsType } from "../models/settings"
import { errCodeAndMsg, minsToMillisecs } from "./utility"

// Dynamically loop based on up-to-date settings
export const dynamicLoop = async (
  loop_name: keyof settingsType,
  content: (settings: settingsType) => Promise<void>,
) => {
  const settings = await Resolvers.getSettings()
  const loopMins = Number(settings[loop_name])
  const isActive = settings[String(loop_name).replace(/_loop$/, "")]

  try {
    // Ensure loopMins is valid
    if (isNaN(loopMins) || loopMins <= 0) {
      logger.error(`${loop_name} Error: Invalid loop minutes: ${loopMins}.`)
      return
    }

    // Only execute the loop content if the loop is set to be active
    if (isActive) {
      // Execute whatever is in the content function
      await content(settings)
      // Log for next interval
      logger.info(`${loop_name} Executed. Waiting ${loopMins} minutes.`)
    }

    // Schedule the next execution dynamically
    setTimeout(() => dynamicLoop(loop_name, content), minsToMillisecs(loopMins))
  } catch (err) {
    // If error, retry after interval
    logger.error(`${loop_name} Error: ${errCodeAndMsg(err)}`)
    setTimeout(() => dynamicLoop(loop_name, content), minsToMillisecs(loopMins))
  }
}
