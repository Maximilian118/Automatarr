import Stats, { StatsDocType } from "../../models/stats"
import logger from "../../logger"
import moment from "moment"
import { AuthRequest } from "../../middleware/auth"

interface StatsQueryInput {
  hours_back?: number
  limit?: number
}

const statsResolvers = {
  getStats: async (
    args: { statsInput?: StatsQueryInput },
    req: AuthRequest,
  ): Promise<StatsDocType | null> => {
    if (!req.isAuth) {
      throw new Error("Unauthorised")
    }

    const { statsInput } = args

    try {
      logger.info("statsResolvers | getStats | Fetching stats data...")
      
      // Get the stats document
      let stats = await Stats.findOne() as StatsDocType
      
      if (!stats) {
        logger.warn("statsResolvers | getStats | No stats data found")
        return null
      }
      
      // If filtering parameters are provided, filter the data points
      if (statsInput && (statsInput.hours_back || statsInput.limit)) {
        const { hours_back, limit } = statsInput
        
        let filteredDataPoints = [...stats.data_points]
        
        // Filter by time if hours_back is specified
        if (hours_back) {
          const cutoffTime = moment().subtract(hours_back, 'hours')
          filteredDataPoints = filteredDataPoints.filter(point => 
            moment(point.timestamp).isAfter(cutoffTime)
          )
        }
        
        // Limit results if limit is specified
        if (limit) {
          filteredDataPoints = filteredDataPoints.slice(-limit)
        }
        
        // Create a plain copy of the stats document with only the filtered data points
        stats = {
          ...stats.toObject(),
          data_points: filteredDataPoints,
        } as StatsDocType
      }
      
      logger.success(`statsResolvers | getStats | Returning ${stats.data_points.length} data points`)
      return stats
      
    } catch (error) {
      logger.error(`statsResolvers | getStats | Error fetching stats: ${error}`)
      throw new Error(`Failed to fetch stats: ${error}`)
    }
  },
}

export default statsResolvers