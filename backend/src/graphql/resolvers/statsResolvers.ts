import logger from "../../logger"
import Stats, { statsType } from "../../models/stats"

const statsResolvers = {
  newStats: async (): Promise<statsType> => {
    // Check if a stats object already exists
    const stats = await Stats.findOne()

    // Return stats object if it already exists
    if (stats) {
      logger.info("newStats: Found stats object.")
      return stats
    }

    // Create a new stats object
    const newStats = new Stats({}, (err: string) => {
      if (err) {
        logger.error("newStats: Could not create new Stats.")
        throw new Error(err)
      }
    })

    // Push stats object to the databse
    await newStats.save()
    logger.info("newStats: New stats object created.")

    return newStats._doc
  },
  updateStats: async (args: { statsInput: statsType }): Promise<statsType> => {
    const {
      _id,
      radarr_total,
      radarr_queue,
      radarr_missing,
      sonarr_total,
      sonarr_queue,
      sonarr_missing,
      lidarr_total,
      lidarr_queue,
      lidarr_missing,
    } = args.statsInput

    // Find stats object by ID
    const stats = await Stats.findById(_id)

    // Throw error if no object was found
    if (!stats) {
      logger.error("updateStats: No Stats by that ID were found.")
      throw new Error("No stats by that ID were found.")
    }

    // Update all the things
    stats.radarr_total = radarr_total
    stats.radarr_queue = radarr_queue
    stats.radarr_missing = radarr_missing
    stats.sonarr_total = sonarr_total
    stats.sonarr_queue = sonarr_queue
    stats.sonarr_missing = sonarr_missing
    stats.lidarr_total = lidarr_total
    stats.lidarr_queue = lidarr_queue
    stats.lidarr_missing = lidarr_missing

    // Save the updated object
    await stats.save()

    // Return the updated object
    return stats._doc
  },
  getStats: async (): Promise<statsType> => {
    // Find what should be the only stats object in the db
    const stats = await Stats.findOne()

    // Throw error if no object was found
    if (!stats) {
      logger.error("getStats: No stats by that ID were found.")
      throw new Error("No stats by that ID were found.")
    }

    // Return the stats object
    return stats._doc
  },
}

export default statsResolvers
