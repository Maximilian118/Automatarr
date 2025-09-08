import { dataDocType } from "../models/data"
import { StatsSnapshot, HourlyStats } from "../models/stats"
import moment from "moment"
import logger from "../logger"

export interface StatsCalculationResult {
  currentSnapshot: StatsSnapshot
  shouldCreateHourlyEntry: boolean
  hourlyEntry?: HourlyStats
}

/**
 * Calculate current statistics snapshot from API data
 */
export const calculateCurrentSnapshot = (data: dataDocType): StatsSnapshot => {
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

  // Process library data (Radarr, Sonarr, etc.)
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

  // Process download queue data
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
    
    // Calculate disk usage from queue items
    queueData.forEach((item: any) => {
      if (item.sizeleft && item.size) {
        const downloaded = item.size - item.sizeleft
        currentSnapshot.diskUsage += downloaded
      }
    })
  }

  // Process qBittorrent torrent data
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

  return currentSnapshot
}

/**
 * Calculate differences between current and previous snapshots
 */
export const calculateSnapshotDifferences = (
  currentSnapshot: StatsSnapshot, 
  previousSnapshot: StatsSnapshot | undefined
) => {
  const downloadedDiff = {
    movies: Math.max(0, currentSnapshot.downloaded.movies - (previousSnapshot?.downloaded.movies || 0)),
    series: Math.max(0, currentSnapshot.downloaded.series - (previousSnapshot?.downloaded.series || 0)),
    episodes: Math.max(0, currentSnapshot.downloaded.episodes - (previousSnapshot?.downloaded.episodes || 0)),
  }
  
  const deletedDiff = {
    movies: Math.max(0, (previousSnapshot?.downloaded.movies || 0) - currentSnapshot.downloaded.movies),
    series: Math.max(0, (previousSnapshot?.downloaded.series || 0) - currentSnapshot.downloaded.series),
    episodes: Math.max(0, (previousSnapshot?.downloaded.episodes || 0) - currentSnapshot.downloaded.episodes),
  }

  return { downloadedDiff, deletedDiff }
}

/**
 * Create a new hourly stats entry
 */
export const createHourlyStatsEntry = (
  currentHour: string,
  currentSnapshot: StatsSnapshot,
  downloadedDiff: any,
  deletedDiff: any
): HourlyStats => {
  return {
    hour: currentHour,
    downloaded: downloadedDiff,
    deleted: deletedDiff,
    averageDiskUsage: currentSnapshot.diskUsage,
    averageBandwidth: currentSnapshot.totalBandwidth,
    peakActiveDownloads: currentSnapshot.activeDownloads,
  }
}

/**
 * Update existing hourly stats entry with new data
 */
export const updateExistingHourlyEntry = (
  hourlyEntry: HourlyStats,
  currentSnapshot: StatsSnapshot
): void => {
  hourlyEntry.averageDiskUsage = (hourlyEntry.averageDiskUsage + currentSnapshot.diskUsage) / 2
  hourlyEntry.averageBandwidth = (hourlyEntry.averageBandwidth + currentSnapshot.totalBandwidth) / 2
  hourlyEntry.peakActiveDownloads = Math.max(hourlyEntry.peakActiveDownloads, currentSnapshot.activeDownloads)
}

/**
 * Generate daily stats by aggregating hourly data
 */
export const generateDailyStats = (
  hourlyStats: HourlyStats[],
  currentDay: string
): HourlyStats | null => {
  const dayHours = hourlyStats.filter(entry => entry.hour.startsWith(currentDay))
  
  if (dayHours.length === 0) {
    return null
  }

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
    { 
      downloaded: { movies: 0, series: 0, episodes: 0 }, 
      deleted: { movies: 0, series: 0, episodes: 0 }, 
      averageDiskUsage: 0, 
      averageBandwidth: 0, 
      peakActiveDownloads: 0 
    }
  )
  
  return {
    hour: currentDay,
    downloaded: dailyTotals.downloaded,
    deleted: dailyTotals.deleted,
    averageDiskUsage: dailyTotals.averageDiskUsage / dayHours.length,
    averageBandwidth: dailyTotals.averageBandwidth / dayHours.length,
    peakActiveDownloads: dailyTotals.peakActiveDownloads,
  }
}

/**
 * Trim old data to maintain storage limits
 */
export const trimHistoricalData = (hourlyStats: HourlyStats[], dailyStats: HourlyStats[]) => {
  const HOURLY_RETENTION_HOURS = 168 // 7 days
  const DAILY_RETENTION_DAYS = 30
  
  const trimmedHourly = hourlyStats.length > HOURLY_RETENTION_HOURS 
    ? hourlyStats.slice(-HOURLY_RETENTION_HOURS)
    : hourlyStats
    
  const trimmedDaily = dailyStats.length > DAILY_RETENTION_DAYS
    ? dailyStats.slice(-DAILY_RETENTION_DAYS) 
    : dailyStats

  return { trimmedHourly, trimmedDaily }
}

/**
 * Check if enough time has passed since last update
 */
export const shouldSkipUpdate = (lastUpdateTime: string, minimumIntervalMinutes: number = 55): boolean => {
  const lastUpdate = moment(lastUpdateTime)
  const now = moment()
  const timeSinceLastUpdate = now.diff(lastUpdate, 'minutes')
  
  return timeSinceLastUpdate < minimumIntervalMinutes
}

/**
 * Log stats update information
 */
export const logStatsUpdate = (action: 'skip' | 'create' | 'update', details: string): void => {
  switch (action) {
    case 'skip':
      logger.info(`updateStats: ${details}`)
      break
    case 'create':
      logger.success(`updateStats: ${details}`)
      break
    case 'update':
      logger.info(`updateStats: ${details}`)
      break
  }
}