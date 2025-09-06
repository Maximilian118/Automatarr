import Stats, { statsDocType, statsType, StatsSnapshot, HourlyStats } from "../../models/stats"
import Data, { dataDocType } from "../../models/data"
import Settings, { settingsDocType } from "../../models/settings"
import logger from "../../logger"
import moment from "moment"
import { AuthRequest } from "../../middleware/auth"
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
      let stats = (await Stats.findOne()) as statsDocType
      
      if (!stats) {
        stats = (await statsResolvers.initStats()) as statsDocType
      }
      
      // Check if we should skip this update (within 55 minutes of last update to avoid near-duplicates)
      const lastUpdate = moment(stats.updated_at)
      const now = moment()
      const timeSinceLastUpdate = now.diff(lastUpdate, 'minutes')
      
      if (timeSinceLastUpdate < 55) {
        logger.info(`updateStats: Skipping update. Only ${timeSinceLastUpdate} minutes since last update.`)
        return stats
      }
      
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
      
      // Note: activeAPIsArr will be used in future for getting more detailed stats from individual services
      // const { activeAPIs } = await activeAPIsArr(settings._doc)
      
      const currentSnapshot: StatsSnapshot = {
        timestamp: moment().format(),
        downloaded: { movies: 0, series: 0, episodes: 0 },
        deleted: { movies: 0, series: 0, episodes: 0 },
        diskUsage: 0,
        activeDownloads: 0,
        queuedDownloads: 0,
        failedDownloads: 0,
        totalBandwidth: 0,
      }
      
      for (const library of data.libraries) {
        const mediaData = library.data
        
        if (library.name === "Radarr") {
          currentSnapshot.downloaded.movies = mediaData.filter((item: any) => item.hasFile).length
        } else if (library.name === "Sonarr") {
          currentSnapshot.downloaded.series = mediaData.filter((item: any) => item.episodeFileCount > 0).length
          
          if (library.episodes) {
            currentSnapshot.downloaded.episodes = library.episodes.filter((ep: any) => ep.hasFile).length
          }
        }
      }
      
      for (const queue of data.downloadQueues) {
        const queueData = queue.data
        
        currentSnapshot.activeDownloads += queueData.filter((item: any) => 
          item.status === "downloading"
        ).length
        
        currentSnapshot.queuedDownloads += queueData.filter((item: any) => 
          item.status === "queued" || item.status === "delay"
        ).length
        
        currentSnapshot.failedDownloads += queueData.filter((item: any) => 
          item.status === "failed" || item.status === "warning"
        ).length
        
        queueData.forEach((item: any) => {
          if (item.sizeleft && item.size) {
            const downloaded = item.size - item.sizeleft
            currentSnapshot.diskUsage += downloaded
          }
        })
      }
      
      if (data.qBittorrent.torrents && data.qBittorrent.torrents.length > 0) {
        const activeTorrents = data.qBittorrent.torrents.filter((torrent: any) => 
          torrent.state === "downloading" || torrent.state === "uploading"
        )
        
        activeTorrents.forEach((torrent: any) => {
          currentSnapshot.totalBandwidth += (torrent.dlspeed || 0) + (torrent.upspeed || 0)
        })
        
        data.qBittorrent.torrents.forEach((torrent: any) => {
          if (torrent.completed) {
            currentSnapshot.diskUsage += torrent.completed
          }
        })
      }
      
      // Store previous snapshot for comparison
      const previousSnapshot = stats.currentSnapshot
      stats.currentSnapshot = currentSnapshot
      
      const currentHour = moment().format("YYYY-MM-DD HH:00:00")
      let hourlyEntry = stats.hourlyStats.find(entry => entry.hour === currentHour)
      
      if (!hourlyEntry) {
        // Calculate actual changes since previous snapshot
        const downloadedDiff = {
          movies: Math.max(0, currentSnapshot.downloaded.movies - (previousSnapshot?.downloaded.movies || 0)),
          series: Math.max(0, currentSnapshot.downloaded.series - (previousSnapshot?.downloaded.series || 0)),
          episodes: Math.max(0, currentSnapshot.downloaded.episodes - (previousSnapshot?.downloaded.episodes || 0)),
        }
        
        // Calculate deleted items (if current count is less than previous)
        const deletedDiff = {
          movies: Math.max(0, (previousSnapshot?.downloaded.movies || 0) - currentSnapshot.downloaded.movies),
          series: Math.max(0, (previousSnapshot?.downloaded.series || 0) - currentSnapshot.downloaded.series),
          episodes: Math.max(0, (previousSnapshot?.downloaded.episodes || 0) - currentSnapshot.downloaded.episodes),
        }
        
        const newHourlyEntry: HourlyStats = {
          hour: currentHour,
          downloaded: downloadedDiff,
          deleted: deletedDiff,
          averageDiskUsage: currentSnapshot.diskUsage,
          averageBandwidth: currentSnapshot.totalBandwidth,
          peakActiveDownloads: currentSnapshot.activeDownloads,
        }
        
        stats.hourlyStats.push(newHourlyEntry)
        
        // Keep only last 7 days of hourly data (168 hours)
        if (stats.hourlyStats.length > 168) {
          stats.hourlyStats = stats.hourlyStats.slice(-168)
        }
        
        // Generate daily stats by aggregating hourly data
        const currentDay = moment().format("YYYY-MM-DD")
        const dayHours = stats.hourlyStats.filter(entry => entry.hour.startsWith(currentDay))
        
        if (dayHours.length > 0) {
          const dailyTotals = dayHours.reduce(
            (acc, hour) => ({
              downloaded: {
                movies: acc.downloaded.movies + hour.downloaded.movies,
                series: acc.downloaded.series + hour.downloaded.series,
                episodes: acc.downloaded.episodes + hour.downloaded.episodes,
              },
              deleted: {
                movies: acc.deleted.movies + hour.deleted.movies,
                series: acc.deleted.series + hour.deleted.series,
                episodes: acc.deleted.episodes + hour.deleted.episodes,
              },
              averageDiskUsage: acc.averageDiskUsage + hour.averageDiskUsage,
              averageBandwidth: acc.averageBandwidth + hour.averageBandwidth,
              peakActiveDownloads: Math.max(acc.peakActiveDownloads, hour.peakActiveDownloads),
            }),
            { downloaded: { movies: 0, series: 0, episodes: 0 }, deleted: { movies: 0, series: 0, episodes: 0 }, averageDiskUsage: 0, averageBandwidth: 0, peakActiveDownloads: 0 }
          )
          
          // Update or create daily entry
          const existingDayIndex = stats.dailyStats.findIndex(entry => entry.hour === currentDay)
          const dailyEntry: HourlyStats = {
            hour: currentDay,
            downloaded: dailyTotals.downloaded,
            deleted: dailyTotals.deleted,
            averageDiskUsage: dailyTotals.averageDiskUsage / dayHours.length,
            averageBandwidth: dailyTotals.averageBandwidth / dayHours.length,
            peakActiveDownloads: dailyTotals.peakActiveDownloads,
          }
          
          if (existingDayIndex >= 0) {
            stats.dailyStats[existingDayIndex] = dailyEntry
          } else {
            stats.dailyStats.push(dailyEntry)
          }
          
          // Keep only last 30 days of daily data
          if (stats.dailyStats.length > 30) {
            stats.dailyStats = stats.dailyStats.slice(-30)
          }
        }
        
        logger.success(`updateStats: Created new hourly entry for ${currentHour}`)
      } else {
        // Update existing hourly entry with running averages
        hourlyEntry.averageDiskUsage = (hourlyEntry.averageDiskUsage + currentSnapshot.diskUsage) / 2
        hourlyEntry.averageBandwidth = (hourlyEntry.averageBandwidth + currentSnapshot.totalBandwidth) / 2
        hourlyEntry.peakActiveDownloads = Math.max(hourlyEntry.peakActiveDownloads, currentSnapshot.activeDownloads)
        
        logger.info(`updateStats: Updated existing hourly entry for ${currentHour}`)
      }
      
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