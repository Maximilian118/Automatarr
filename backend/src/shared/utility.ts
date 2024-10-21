import Resolvers from "../graphql/resolvers/resolvers"
import logger from "../logger"
import { settingsType } from "../models/settings"

// Simple calculations
export const minsToSecs = (mins: number): number => mins * 60
export const minsToMillisecs = (mins: number): number => mins * 60000
export const secsToMins = (secs: number): number => secs / 60

// Dynamically loop based on up-to-date settings
export const dynamicLoop = async (
  loop_name: keyof settingsType,
  content: (settings: settingsType) => Promise<void>,
) => {
  const settings = await Resolvers.getSettings()
  const loopMins = Number(settings[loop_name])

  try {
    // Ensure loopMins is valid
    if (isNaN(loopMins) || loopMins <= 0) {
      logger.error(`${loop_name} Error: Invalid loop minutes: ${loopMins}.`)
      return
    }
    // Execute whatever is in the content function
    await content(settings)
    // Log for next interval
    logger.info(`${loop_name} Executed. Waiting ${loopMins} minutes.`)
    // Schedule the next execution dynamically
    setTimeout(() => dynamicLoop(loop_name, content), minsToMillisecs(loopMins))
  } catch (err) {
    // If error, retry after interval
    logger.error(`${loop_name} Error: ${err}`)
    setTimeout(() => dynamicLoop(loop_name, content), minsToMillisecs(loopMins))
  }
}
