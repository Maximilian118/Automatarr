import logger from "../logger"
import Settings, { settingsDocType, settingsType } from "../models/settings"
import { minsToMillisecs } from "./utility"

// A global Set to track active loops
const activeLoops = new Set<keyof settingsType>()

// Dynamically loop based on up-to-date settings
export const dynamicLoop = async (
  loop_name: keyof settingsType,
  content: (settings: settingsType) => Promise<void>,
  skipFirst?: boolean, // Optionally skip the first execution if we've just called the content function outside of dynamicLoop
  loopTimer?: number, // Optionally provide a custom loop timer in minutes
) => {
  const settings = (await Settings.findOne()) as settingsDocType | null

  // Throw error if no settings were found
  if (!settings) {
    logger.error(`dynamicLoop | ${loop_name} | No Settings were found.`)
    return
  }

  // Throw error if no _doc exists in settings
  if (!settings._doc) {
    logger.error(`dynamicLoop | ${loop_name} | Settings were found but no _doc.`)
    return
  }

  const loopMins = loopTimer ? loopTimer : Number(settings._doc[loop_name]) // Grab the timer from the loop set by user in UI
  const isActive = settings._doc[String(loop_name).replace(/_loop$/, "")] // check if user has enabled this loop in the UI

  // If the loop is inactive, stop further execution
  if (!isActive && !loopTimer) {
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
      await content(settings._doc)
    }

    // Log wait time for next interval
    // prettier-ignore
    logger.info(`${loop_name} ${skipFirst ? "skipping first loop" : "executed"}. Waiting ${loopMins} minutes.`)

    // Schedule the next execution dynamically
    setTimeout(() => {
      activeLoops.delete(loop_name) // Clear the flag before restarting
      dynamicLoop(loop_name, content, false, loopTimer)
    }, minsToMillisecs(loopMins)) // Execute loop again with latest loopMins
  } catch (err) {
    // If error, retry after interval
    logger.error(`${loop_name} Error: ${err}`)

    setTimeout(() => {
      activeLoops.delete(loop_name) // Clear the flag before restarting
      dynamicLoop(loop_name, content, false, loopTimer)
    }, minsToMillisecs(loopMins)) // Execute loop again with latest loopMins
  }
}
