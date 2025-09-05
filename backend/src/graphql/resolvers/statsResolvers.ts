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
      
      stats.currentSnapshot = currentSnapshot
      
      const currentHour = moment().format("YYYY-MM-DD HH:00:00")
      let hourlyEntry = stats.hourlyStats.find(entry => entry.hour === currentHour)
      
      if (!hourlyEntry) {
        const previousSnapshot = stats.hourlyStats[stats.hourlyStats.length - 1]
        
        const newHourlyEntry: HourlyStats = {
          hour: currentHour,
          downloaded: {
            movies: currentSnapshot.downloaded.movies - (previousSnapshot?.downloaded.movies || 0),
            series: currentSnapshot.downloaded.series - (previousSnapshot?.downloaded.series || 0),
            episodes: currentSnapshot.downloaded.episodes - (previousSnapshot?.downloaded.episodes || 0),
          },
          deleted: { movies: 0, series: 0, episodes: 0 },
          averageDiskUsage: currentSnapshot.diskUsage,
          averageBandwidth: currentSnapshot.totalBandwidth,
          peakActiveDownloads: currentSnapshot.activeDownloads,
        }
        
        stats.hourlyStats.push(newHourlyEntry)
        
        if (stats.hourlyStats.length > 168) {
          stats.hourlyStats = stats.hourlyStats.slice(-168)
        }
      } else {
        hourlyEntry.averageDiskUsage = (hourlyEntry.averageDiskUsage + currentSnapshot.diskUsage) / 2
        hourlyEntry.averageBandwidth = (hourlyEntry.averageBandwidth + currentSnapshot.totalBandwidth) / 2
        hourlyEntry.peakActiveDownloads = Math.max(hourlyEntry.peakActiveDownloads, currentSnapshot.activeDownloads)
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