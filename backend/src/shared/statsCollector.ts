import moment from "moment"
import logger from "../logger"
import Data, { dataDocType } from "../models/data"
import Settings, { settingsDocType } from "../models/settings"
import Stats, { StatsDataPoint, MovieMetrics, SeriesMetrics, StorageMetrics, SystemMetrics } from "../models/stats"
import { saveWithRetry } from "./database"

// Collect movie metrics from current data
const collectMovieMetrics = async (data: dataDocType): Promise<MovieMetrics> => {
  const movieLibraries = data.libraries.filter(lib => lib.name === "Radarr")
  const movieQueues = data.downloadQueues.filter(queue => queue.name === "Radarr")
  
  let downloaded = 0
  let queued = 0
  let totalLibrarySize = 0
  
  // Count downloaded movies from libraries
  movieLibraries.forEach(lib => {
    if (Array.isArray(lib.data)) {
      totalLibrarySize += lib.data.length
      downloaded += lib.data.filter((movie: any) => movie.hasFile === true).length
    }
  })
  
  // Count queued movies
  movieQueues.forEach(queue => {
    if (Array.isArray(queue.data)) {
      queued += queue.data.length
    }
  })
  
  return {
    downloaded,
    deleted: 0, // This will be incremented when deletion events occur
    queued,
    total_library_size: totalLibrarySize,
  }
}

// Collect series metrics from current data
const collectSeriesMetrics = async (data: dataDocType): Promise<SeriesMetrics> => {
  const seriesLibraries = data.libraries.filter(lib => lib.name === "Sonarr")
  const seriesQueues = data.downloadQueues.filter(queue => queue.name === "Sonarr")
  
  let downloaded = 0
  let queued = 0
  let totalLibrarySize = 0
  let episodesDownloaded = 0
  
  // Count downloaded series from libraries
  seriesLibraries.forEach(lib => {
    if (Array.isArray(lib.data)) {
      totalLibrarySize += lib.data.length
      lib.data.forEach((series: any) => {
        if (series.statistics && series.statistics.episodeFileCount > 0) {
          downloaded += 1
          episodesDownloaded += series.statistics.episodeFileCount
        }
      })
    }
  })
  
  // Count queued series
  seriesQueues.forEach(queue => {
    if (Array.isArray(queue.data)) {
      queued += queue.data.length
    }
  })
  
  return {
    downloaded,
    deleted: 0, // This will be incremented when deletion events occur
    queued,
    total_library_size: totalLibrarySize,
    episodes_downloaded: episodesDownloaded,
    episodes_deleted: 0, // This will be incremented when deletion events occur
  }
}

// Collect storage metrics
const collectStorageMetrics = async (settings: settingsDocType): Promise<StorageMetrics> => {
  const minFreeSpace = parseInt(settings.general_bot.min_free_space) || 0
  
  // Get storage info from root folders (more reliable than diskspace API)
  let totalStorage = 0
  let freeStorage = 0
  
  const data = await Data.findOne()
  const rootFolders = data?.rootFolders || []
  
  let isConsistent = true
  
  if (rootFolders.length > 0) {
    const rootFolderValues: { api: string; free: number; total?: number }[] = []
    
    rootFolders.forEach(rootFolderData => {
      if (rootFolderData?.data) {
        const folder = rootFolderData.data
        // logger.info(`statsCollector | ${rootFolderData.name} root folder: path="${folder.path}", freeSpace=${(folder.freeSpace / (1024**4)).toFixed(2)} TiB, totalSpace=${folder.totalSpace ? (folder.totalSpace / (1024**4)).toFixed(2) : 'unknown'} TiB`)
        
        rootFolderValues.push({
          api: rootFolderData.name,
          free: folder.freeSpace,
          total: folder.totalSpace,
        })
      }
    })
    
    if (rootFolderValues.length > 0) {
      // Use the free space from root folders (should be consistent)
      freeStorage = rootFolderValues[0].free
      
      // For total space, try to use totalSpace if available, otherwise estimate
      if (rootFolderValues[0].total) {
        totalStorage = rootFolderValues[0].total
        logger.info(`statsCollector | Using root folder storage: ${(totalStorage / (1024**4)).toFixed(1)} TiB total, ${(freeStorage / (1024**4)).toFixed(1)} TiB free`)
      } else {
        // Estimate total space - with 7.4TiB free out of ~42TiB total, that's about 17.5% free
        // So: totalSpace = freeSpace / 0.175 ≈ freeSpace * 5.7
        const estimatedTotal = freeStorage * 5.7 // Estimate based on typical 82.5% usage
        totalStorage = estimatedTotal
        logger.info(`statsCollector | Using root folder with estimated total: ${(totalStorage / (1024**4)).toFixed(1)} TiB total (estimated), ${(freeStorage / (1024**4)).toFixed(1)} TiB free`)
      }
      
      // Check consistency between APIs (free space should be similar)
      if (rootFolderValues.length > 1) {
        const tolerance = freeStorage * 0.05 // 5% tolerance for free space differences
        isConsistent = rootFolderValues.every(folder => 
          Math.abs(folder.free - freeStorage) <= tolerance
        )
        
        if (!isConsistent) {
          logger.warn(`statsCollector | Root folder free space values differ between APIs, using first API's values`)
        }
      }
    }
  }
  
  const usedPercentage = totalStorage > 0 ? ((totalStorage - freeStorage) / totalStorage) * 100 : 0
  
  return {
    total_storage: totalStorage,
    free_storage: freeStorage,
    minimum_free_storage: minFreeSpace,
    used_percentage: Math.round(usedPercentage * 100) / 100, // Round to 2 decimal places
    storage_consistency: isConsistent ? 'consistent' : 'inconsistent',
  }
}

// Collect system metrics
const collectSystemMetrics = async (data: dataDocType, settings: settingsDocType): Promise<SystemMetrics> => {
  const botUsers = settings.general_bot.users || []
  const activeUsers = botUsers.length
  
  // Count active loops by checking which loop settings are enabled
  let activeLoops = 0
  if (settings.remove_blocked) activeLoops++
  if (settings.wanted_missing) activeLoops++
  if (settings.remove_failed) activeLoops++
  if (settings.remove_missing) activeLoops++
  if (settings.permissions_change) activeLoops++
  if (settings.tidy_directories) activeLoops++
  
  // Count downloads from all queues
  let totalDownloads = 0
  let failedDownloads = 0
  let blockedDownloads = 0
  
  data.downloadQueues.forEach(queue => {
    if (Array.isArray(queue.data)) {
      queue.data.forEach((download: any) => {
        totalDownloads++
        if (download.status === "failed") failedDownloads++
        if (download.status === "warning" || download.status === "importBlocked") blockedDownloads++
      })
    }
  })
  
  return {
    active_users: activeUsers,
    active_loops: activeLoops,
    total_downloads: totalDownloads,
    failed_downloads: failedDownloads,
    blocked_downloads: blockedDownloads,
  }
}

// Main stats collection function
export const clearStats = async (): Promise<void> => {
  try {
    const stats = await Stats.findOne()
    if (stats) {
      stats.data_points = []
      await stats.save()
      logger.success("statsCollector | Cleared all existing stats data")
    } else {
      logger.info("statsCollector | No existing stats to clear")
    }
  } catch (error) {
    logger.error(`statsCollector | Error clearing stats: ${error}`)
  }
}

export const collectStats = async (): Promise<void> => {
  try {
    logger.success("statsCollector | Starting stats collection...")
    
    // Get current data and settings
    const data = await Data.findOne() as dataDocType
    const settings = await Settings.findOne() as settingsDocType
    
    if (!data || !settings) {
      logger.error("statsCollector | Could not find data or settings objects")
      return
    }
    
    // Collect all metrics
    const [movies, series, storage, system] = await Promise.all([
      collectMovieMetrics(data),
      collectSeriesMetrics(data),
      collectStorageMetrics(settings),
      collectSystemMetrics(data, settings),
    ])
    
    // Create new data point
    const currentTimestamp = moment().format()
    const dataPoint: StatsDataPoint = {
      timestamp: currentTimestamp,
      movies,
      series,
      storage,
      system,
    }
    
    logger.info(`statsCollector | Creating data point for timestamp: ${currentTimestamp}`)
    
    // Get or create stats document  
    let stats = await Stats.findOne()
    if (!stats) {
      stats = new Stats({
        data_points: [dataPoint]
      })
      logger.info(`statsCollector | Created new stats document with first data point`)
    } else {
      logger.info(`statsCollector | Found existing stats with ${stats.data_points.length} data points. Last point: ${stats.data_points[stats.data_points.length - 1]?.timestamp}`)
      // Add new data point
      stats.data_points.push(dataPoint)
      
      // Keep only last 720 data points (30 days of hourly data)
      if (stats.data_points.length > 720) {
        stats.data_points = stats.data_points.slice(-720)
      }
      
      stats.updated_at = moment().format()
    }
    
    // Save to database with retry mechanism
    await saveWithRetry(stats as any, "stats collection")
    
    logger.success(`statsCollector | Stats collected successfully. Total data points: ${stats.data_points.length}`)
    
  } catch (error) {
    logger.error(`statsCollector | Error collecting stats: ${error}`)
  }
}

// Increment deletion counters (to be called when deletions occur)
export const incrementMovieDeletions = async (count: number = 1): Promise<void> => {
  try {
    const stats = await Stats.findOne()
    if (stats && stats.data_points.length > 0) {
      const latestPoint = stats.data_points[stats.data_points.length - 1]
      latestPoint.movies.deleted += count
      await saveWithRetry(stats as any, "increment movie deletions")
      logger.info(`statsCollector | Incremented movie deletions by ${count}`)
    }
  } catch (error) {
    logger.error(`statsCollector | Error incrementing movie deletions: ${error}`)
  }
}

export const incrementSeriesDeletions = async (seriesCount: number = 1, episodeCount: number = 0): Promise<void> => {
  try {
    const stats = await Stats.findOne()
    if (stats && stats.data_points.length > 0) {
      const latestPoint = stats.data_points[stats.data_points.length - 1]
      latestPoint.series.deleted += seriesCount
      latestPoint.series.episodes_deleted += episodeCount
      await saveWithRetry(stats as any, "increment series deletions")
      logger.info(`statsCollector | Incremented series deletions by ${seriesCount}, episodes by ${episodeCount}`)
    }
  } catch (error) {
    logger.error(`statsCollector | Error incrementing series deletions: ${error}`)
  }
}