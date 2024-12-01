import Resolvers from "../graphql/resolvers/resolvers"
import logger from "../logger"
import { settingsType } from "../models/settings"
import { errCodeAndMsg, minsToMillisecs } from "./utility"

// A global Set to track active loops
const activeLoops = new Set<keyof settingsType>()

// Dynamically loop based on up-to-date settings
export const dynamicLoop = async (
  loop_name: keyof settingsType,
  content: (settings: settingsType) => Promise<void>,
  skipFirst?: boolean, // Optionally skip the first execution if we've just called the content function outside of dynamicLoop
) => {
  const settings = await Resolvers.getSettings()
  const loopMins = Number(settings[loop_name])
  const isActive = settings[String(loop_name).replace(/_loop$/, "")]

  // If the loop is inactive, stop further execution
  if (!isActive) {
    logger.info(`${loop_name} is inactive. ${activeLoops.has(loop_name) ? "Stopping Loop." : ""}`)
    activeLoops.delete(loop_name) // Remove the loop from activeLoops
    return
  }

  // Check if this loop is already in activeLoops
  if (activeLoops.has(loop_name)) {
    logger.warn(`${loop_name} has already started.`)
    return
  }

  try {
    // Ensure loopMins is valid
    if (isNaN(loopMins) || loopMins <= 0) {
      logger.error(`${loop_name} Error: Invalid loop minutes: ${loopMins}.`)
      return
    }

    // Mark this loop as active
    activeLoops.add(loop_name)

    // If we're not skipping execution
    if (!skipFirst) {
      // Execute whatever is in the content function
      await content(settings)
    }

    // Log wait time for next interval
    // prettier-ignore
    logger.info(`${loop_name} ${skipFirst ? "skipping first loop" : "executed"}. Waiting ${loopMins} minutes.`)

    // Schedule the next execution dynamically
    setTimeout(() => {
      activeLoops.delete(loop_name) // Clear the flag before restarting
      dynamicLoop(loop_name, content)
    }, minsToMillisecs(loopMins)) // Execute loop again with latest loopMins
  } catch (err) {
    // If error, retry after interval
    logger.error(`${loop_name} Error: ${errCodeAndMsg(err)}`)

    setTimeout(() => {
      activeLoops.delete(loop_name) // Clear the flag before restarting
      dynamicLoop(loop_name, content)
    }, minsToMillisecs(loopMins)) // Execute loop again with latest loopMins
  }
}
