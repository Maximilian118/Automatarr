import moment from "moment"
import { Theme } from "@mui/material"
import { StatsDataPoint, NivoLineData } from "../types/statsType"

// ========================================
// FORMATTING UTILITIES
// ========================================

/**
 * Converts bytes to human-readable storage format (B, KB, MB, GB, TB, PB)
 * @param bytes - Number of bytes to format
 * @returns Formatted string with appropriate unit
 */
export const formatStorage = (bytes: number): string => {
  if (bytes === 0) return '0 B'
  
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}

/**
 * Formats timestamp for daily chart x-axis labels
 * @param timestamp - ISO timestamp string
 * @returns Formatted day/month string (e.g., "09/09")
 */
export const formatDailyChartTimestamp = (timestamp: string): string => {
  return moment(timestamp).format("D")
}

/**
 * Formats timestamp for chart x-axis labels based on screen size (legacy - kept for compatibility)
 * @param timestamp - ISO timestamp string
 * @param isMobile - Whether the current screen is mobile-sized
 * @returns Formatted time string
 */
export const formatChartTimestamp = (timestamp: string, isMobile: boolean): string => {
  return moment(timestamp).format(isMobile ? "DD HH:mm" : "DD/MM HH:mm")
}

// ========================================
// CHART CALCULATION UTILITIES
// ========================================

const ONE_TERABYTE = Math.pow(1024, 4)

/**
 * Calculates the maximum Y-axis value for the storage line chart with 25% padding
 * Enforces a minimum of 1 TB so small drives don't produce a squashed chart
 * @param data - Array of stats data points
 * @returns Maximum value in bytes with padding, minimum of 1 TB
 */
export const calculateStorageChartMaxValue = (data: StatsDataPoint[]): number => {
  if (!data.length) return ONE_TERABYTE

  let maxTotal = 0
  data.forEach(point => {
    maxTotal = Math.max(maxTotal, Number(point.storage.total_storage))
  })

  // Use max total directly as the ceiling, with a floor of 1 TB for small drives
  return Math.max(maxTotal, ONE_TERABYTE)
}

/**
 * Generates evenly spaced Y-axis tick values for the storage chart
 * The top tick is always the exact max value so it displays on the axis
 * @param maxValue - The maximum Y-axis value in bytes
 * @param tickCount - Number of ticks to generate (default 10)
 * @returns Array of tick values from 0 to maxValue
 */
export const generateStorageTickValues = (maxValue: number, tickCount: number = 10): number[] => {
  const step = maxValue / tickCount
  const ticks: number[] = []

  for (let i = 0; i <= tickCount; i++) {
    ticks.push(step * i)
  }

  return ticks
}

/**
 * Calculates the maximum Y-axis value for charts with 25% padding
 * @param data - Array of stats data points
 * @param category - Either 'movies' or 'series' to determine which data to analyze
 * @returns Maximum value with padding, minimum of 10
 */
export const calculateChartMaxValue = (data: StatsDataPoint[], category: 'movies' | 'series'): number => {
  if (!data.length) return 100
  
  let maxValue = 0
  data.forEach(point => {
    const categoryData = point[category]
    maxValue = Math.max(maxValue, categoryData.downloaded, categoryData.queued, categoryData.deleted)
  })
  
  // Add 25% padding above the highest value, with a minimum of 10
  return Math.max(Math.ceil(maxValue * 1.25), 10)
}

/**
 * Calculates optimal number of x-axis ticks based on data points
 * @param dataLength - Number of data points
 * @returns Optimal number of ticks (between 3 and 6)
 */
export const getOptimalTickCount = (dataLength: number): number => {
  return Math.min(6, Math.max(3, Math.ceil(dataLength / 8)))
}

// ========================================
// DATA AGGREGATION UTILITIES
// ========================================

/**
 * Aggregates hourly data points into daily summaries with latest 30 days limit
 * @param data - Array of hourly stats data points
 * @returns Array of daily aggregated data points (max 30 days)
 */
export const aggregateDataByDay = (data: StatsDataPoint[]): StatsDataPoint[] => {
  if (!data.length) return []

  // Group data points by day
  const dailyGroups: { [key: string]: StatsDataPoint[] } = {}
  
  data.forEach(point => {
    const dayKey = moment(point.timestamp).format('YYYY-MM-DD')
    if (!dailyGroups[dayKey]) {
      dailyGroups[dayKey] = []
    }
    dailyGroups[dayKey].push(point)
  })

  // Create daily aggregated points
  const aggregatedData: StatsDataPoint[] = Object.entries(dailyGroups).map(([dayKey, dayPoints]) => {
    // Sort points by timestamp to get the latest values for each day
    const sortedPoints = dayPoints.sort((a, b) => moment(b.timestamp).diff(moment(a.timestamp)))
    const latestPoint = sortedPoints[0]
    
    // Use the latest point's values but set timestamp to end of day
    return {
      ...latestPoint,
      timestamp: moment(dayKey).endOf('day').format()
    }
  })

  // Sort by date and keep only the latest 30 days
  const sortedAggregated = aggregatedData
    .sort((a, b) => moment(a.timestamp).diff(moment(b.timestamp)))
    .slice(-30)

  return sortedAggregated
}

// ========================================
// CHART DATA GENERATORS
// ========================================

/**
 * Converts raw stats data into Nivo line chart format for storage over time with daily aggregation
 * @param data - Array of stats data points
 * @returns Array of chart data series for storage (Disk Size, Used) aggregated by day
 */
export const generateStorageLineChartData = (data: StatsDataPoint[]): NivoLineData[] => {
  if (!data.length) return []

  // Aggregate data by day and limit to 30 days
  const dailyData = aggregateDataByDay(data)

  return [
    {
      id: "Disk Size",
      color: "#F44336",
      data: dailyData.map(point => ({
        x: formatDailyChartTimestamp(point.timestamp),
        y: Number(point.storage.total_storage)
      }))
    },
    {
      id: "Used",
      color: "#4CAF50",
      data: dailyData.map(point => ({
        x: formatDailyChartTimestamp(point.timestamp),
        y: Number(point.storage.total_storage) - Number(point.storage.free_storage)
      }))
    }
  ]
}

/**
 * Converts raw stats data into Nivo line chart format for movies with daily aggregation
 * @param data - Array of stats data points
 * @returns Array of chart data series for movies (downloaded, queued, deleted) aggregated by day
 */
export const generateMovieChartData = (data: StatsDataPoint[]): NivoLineData[] => {
  if (!data.length) return []
  
  // Aggregate data by day and limit to 30 days
  const dailyData = aggregateDataByDay(data)
  
  return [
    {
      id: "Downloaded",
      color: "#4CAF50",
      data: dailyData.map(point => ({
        x: formatDailyChartTimestamp(point.timestamp),
        y: Number(point.movies.downloaded)
      }))
    },
    {
      id: "Queued", 
      color: "#FF9800",
      data: dailyData.map(point => ({
        x: formatDailyChartTimestamp(point.timestamp),
        y: Number(point.movies.queued)
      }))
    },
    {
      id: "Deleted",
      color: "#F44336",
      data: dailyData.map(point => ({
        x: formatDailyChartTimestamp(point.timestamp),
        y: Number(point.movies.deleted)
      }))
    }
  ]
}

/**
 * Converts raw stats data into Nivo line chart format for series with daily aggregation
 * @param data - Array of stats data points
 * @returns Array of chart data series for TV series (downloaded, queued, deleted) aggregated by day
 */
export const generateSeriesChartData = (data: StatsDataPoint[]): NivoLineData[] => {
  if (!data.length) return []
  
  // Aggregate data by day and limit to 30 days
  const dailyData = aggregateDataByDay(data)
  
  return [
    {
      id: "Downloaded",
      color: "#4CAF50",
      data: dailyData.map(point => ({
        x: formatDailyChartTimestamp(point.timestamp),
        y: Number(point.series.downloaded)
      }))
    },
    {
      id: "Queued",
      color: "#FF9800", 
      data: dailyData.map(point => ({
        x: formatDailyChartTimestamp(point.timestamp),
        y: Number(point.series.queued)
      }))
    },
    {
      id: "Deleted",
      color: "#F44336",
      data: dailyData.map(point => ({
        x: formatDailyChartTimestamp(point.timestamp),
        y: Number(point.series.deleted)
      }))
    }
  ]
}

/**
 * Generates storage pie chart data from the latest stats point
 * @param latestPoint - Most recent stats data point
 * @returns Array with used and available storage data for pie chart
 */
export const generateStorageChartData = (latestPoint: StatsDataPoint) => {
  const totalBytes = Number(latestPoint.storage.total_storage)
  const freeBytes = Number(latestPoint.storage.free_storage)
  const usedBytes = totalBytes - freeBytes

  // Convert to appropriate units for display
  const k = 1024
  const totalSize = totalBytes / (k ** 4) // Convert to TiB for large values
  const unit = totalSize >= 1 ? 'TiB' : 'GiB'
  const divisor = totalSize >= 1 ? (k ** 4) : (k ** 3)

  return [
    { 
      id: `Used (${unit})`, 
      value: Math.round((usedBytes / divisor) * 100) / 100, 
      color: "#FF9800"
    },
    { 
      id: `Available (${unit})`, 
      value: Math.round((freeBytes / divisor) * 100) / 100, 
      color: "#4CAF50"
    }
  ]
}

// ========================================
// CHART CONFIGURATION UTILITIES
// ========================================

/**
 * Common chart theme configuration for Nivo charts
 * @param theme - Material-UI theme object
 * @returns Nivo chart theme configuration
 */
export const getChartTheme = (theme: Theme) => ({
  background: 'transparent',
  text: { fill: theme.palette.text.primary },
  axis: {
    domain: { line: { stroke: theme.palette.text.secondary } },
    ticks: { line: { stroke: theme.palette.text.secondary } }
  },
  grid: { line: { stroke: theme.palette.divider } }
})

/**
 * Common legend configuration for line charts
 * @returns Array of legend configuration objects for Nivo line charts
 */
export const getLineLegendConfig = () => ([
  {
    anchor: 'bottom-left' as const,
    direction: 'row' as const,
    justify: false,
    translateX: 0,
    translateY: 86,
    itemsSpacing: 24,
    itemDirection: 'left-to-right' as const,
    itemWidth: 100,
    itemHeight: 20,
    itemOpacity: 0.75,
    symbolSize: 12,
    symbolShape: 'circle' as const,
    symbolBorderColor: 'rgba(0, 0, 0, .5)',
    effects: [
      {
        on: 'hover' as const,
        style: { itemBackground: 'rgba(0, 0, 0, .03)', itemOpacity: 1 }
      }
    ]
  }
])