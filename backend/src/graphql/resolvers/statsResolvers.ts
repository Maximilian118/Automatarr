import Stats, { statsDocType, statsType } from "../../models/stats"
import Data, { dataDocType } from "../../models/data"
import Settings, { settingsDocType } from "../../models/settings"
import logger from "../../logger"
import moment from "moment"
import { AuthRequest } from "../../middleware/auth"
import {
  calculateCurrentSnapshot,
  calculateSnapshotDifferences,
  createHourlyStatsEntry,
  updateExistingHourlyEntry,
  generateDailyStats,
  trimHistoricalData,
  shouldSkipUpdate,
  logStatsUpdate
} from "../../shared/statsUtils"
// import { activeAPIsArr } from "../../shared/activeAPIsArr" // Will be used for future enhancements

const statsResolvers = {
  initStats: async (): Promise<statsType> => {
    const stats = await Stats.findOne()
    
    if (stats) {
      logger.success("MongoDB | Found existing stats object in database.")
      return stats
    }
    
    const newStats = new Stats({}, (err: string) => {
      if (err) {
        logger.error("MongoDB | Could not create new stats object.")
        throw new Error(err)
      }
    })
    
    await newStats.save()
    logger.success("MongoDB | New stats object created.")
    
    return newStats
  },
  
  getStats: async (
    _: any,
    _args: any,
    req: AuthRequest,
  ): Promise<statsType> => {
    if (!req.isAuth) {
      throw new Error("Unauthorised")
    }
    
    let stats = (await Stats.findOne()) as statsDocType
    
    if (!stats) {
      stats = (await statsResolvers.initStats()) as statsDocType
    }
    
    return {
      ...stats._doc,
      tokens: req.tokens,
    }
  },
  
  updateStats: async (): Promise<statsDocType | undefined> => {
    try {
      // Initialize stats document if needed
      let stats = (await Stats.findOne()) as statsDocType
      if (!stats) {
        stats = (await statsResolvers.initStats()) as statsDocType
      }
      
      // Check if enough time has passed since last update
      if (shouldSkipUpdate(stats.updated_at)) {
        const timeSinceLastUpdate = moment().diff(moment(stats.updated_at), 'minutes')
        logStatsUpdate('skip', `Only ${timeSinceLastUpdate} minutes since last update.`)
        return stats
      }
      
      // Validate required data sources
      const settings = (await Settings.findOne()) as settingsDocType
      if (!settings) {
        logger.error("updateStats: No Settings object was found.")
        return
      }
      
      const data = (await Data.findOne()) as dataDocType
      if (!data) {
        logger.error("updateStats: No Data object was found.")
        return
      }
      
      // Calculate current stats snapshot from API data
      const currentSnapshot = calculateCurrentSnapshot(data)
      
      // Store previous snapshot and update current
      const previousSnapshot = stats.currentSnapshot
      stats.currentSnapshot = currentSnapshot
      
      // Process hourly statistics
      const currentHour = moment().format("YYYY-MM-DD HH:00:00")
      let existingHourlyEntry = stats.hourlyStats.find(entry => entry.hour === currentHour)
      
      if (!existingHourlyEntry) {
        // Create new hourly entry
        const { downloadedDiff, deletedDiff } = calculateSnapshotDifferences(currentSnapshot, previousSnapshot)
        const newHourlyEntry = createHourlyStatsEntry(currentHour, currentSnapshot, downloadedDiff, deletedDiff)
        stats.hourlyStats.push(newHourlyEntry)
        
        // Generate and update daily stats
        const currentDay = moment().format("YYYY-MM-DD")
        const dailyEntry = generateDailyStats(stats.hourlyStats, currentDay)
        
        if (dailyEntry) {
          const existingDayIndex = stats.dailyStats.findIndex(entry => entry.hour === currentDay)
          if (existingDayIndex >= 0) {
            stats.dailyStats[existingDayIndex] = dailyEntry
          } else {
            stats.dailyStats.push(dailyEntry)
          }
        }
        
        logStatsUpdate('create', `Created new hourly entry for ${currentHour}`)
      } else {
        // Update existing hourly entry
        updateExistingHourlyEntry(existingHourlyEntry, currentSnapshot)
        logStatsUpdate('update', `Updated existing hourly entry for ${currentHour}`)
      }
      
      // Trim old historical data to maintain storage limits
      const { trimmedHourly, trimmedDaily } = trimHistoricalData(stats.hourlyStats, stats.dailyStats)
      stats.hourlyStats = trimmedHourly
      stats.dailyStats = trimmedDaily
      
      // Save updated stats
      stats.updated_at = moment().format()
      await stats.save()
      
      logger.success("updateStats | Stats saved successfully")
      return stats
    } catch (err) {
      logger.error(`updateStats Error: ${err}`)
      return
    }
  },
}

export default statsResolvers