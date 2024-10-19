import logger from "../../logger"
import Stats, { statsType } from "../../models/stats"

const statsResolvers = {
  newStats: async (): Promise<statsType> => {
    // Check if a stats object already exists
    const stats = await Stats.findOne()

    // Throw error if a stats object exists
    if (stats) {
      logger.error("newStats: A stats object already exists!")
      return stats
    }

    const newStats = new Stats({}, (err: string) => {
      if (err) {
        logger.error("newStats: Could not create new Stats.")
        throw new Error(err)
      }
    })

    await newStats.save()

    return newStats._doc
  },
  updateStats: async (args: { statsInput: statsType }): Promise<statsType> => {
    const {
      _id,
      Radarr_total,
      Radarr_queue,
      Radarr_missing,
      Sonarr_total,
      Sonarr_queue,
      Sonarr_missing,
      Lidarr_total,
      Lidarr_queue,
      Lidarr_missing,
    } = args.statsInput

    // Find stats object by ID
    const stats = await Stats.findById(_id)

    // Throw error if no object was found
    if (!stats) {
      logger.error("updateStats: No Stats by that ID were found.")
      throw new Error("No stats by that ID were found.")
    }

    // Update all the things
    stats.Radarr_total = Radarr_total
    stats.Radarr_queue = Radarr_queue
    stats.Radarr_missing = Radarr_missing
    stats.Sonarr_total = Sonarr_total
    stats.Sonarr_queue = Sonarr_queue
    stats.Sonarr_missing = Sonarr_missing
    stats.Lidarr_total = Lidarr_total
    stats.Lidarr_queue = Lidarr_queue
    stats.Lidarr_missing = Lidarr_missing

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
