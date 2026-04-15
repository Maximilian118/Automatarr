import React, { useContext, useEffect, useState, useMemo } from "react"
import { CircularProgress, Alert } from "@mui/material"
import { PointTooltipProps } from '@nivo/line'
import AppContext from "../../context"
import Footer from "../../components/footer/Footer"
import Graph from "../../components/graphs/Graph"
import Line from "../../components/graphs/graphs/Line/Line"
import Pie from "../../components/graphs/graphs/Pie/Pie"
import { getStats } from "../../shared/requests/statsRequests"
import { StatsType } from "../../types/statsType"
import { useNavigate } from "react-router-dom"
import {
  formatStorage,
  calculateChartMaxValue,
  calculateStorageChartMaxValue,
  generateStorageTickValues,
  generateMovieChartData,
  generateSeriesChartData,
  generateStorageLineChartData,
  generateStorageChartData,
  aggregateDataByDay
} from "../../shared/statsUtilities"
import "./_stats.scss"

// ========================================
// CONSTANTS
// ========================================

// Legend items for movie/series line charts
const legendItems = [
  { label: 'Downloaded', color: '#4CAF50' },
  { label: 'Queued', color: '#FF9800' },
  { label: 'Deleted', color: '#F44336' },
]

// Legend items for storage line chart
const storageLegendItems = [
  { label: 'Storage Size', color: '#F44336' },
  { label: 'Used', color: '#4CAF50' },
]

// Tooltip for storage chart showing formatted byte values
const StorageChartTooltip: React.FC<PointTooltipProps> = ({ point }) => (
  <div className="graph-card" style={{ width: "auto" }}>
    <div style={{ color: point.serieColor, fontWeight: 'bold' }}>
      {point.serieId}: {formatStorage(point.data.y as number)}
    </div>
  </div>
)

// ========================================
// MAIN COMPONENT
// ========================================

const Stats: React.FC = () => {
  // ========================================
  // STATE & HOOKS
  // ========================================

  const { user, setUser, loading, setLoading } = useContext(AppContext)
  const [stats, setStats] = useState<StatsType | null>(null)
  const [error, setError] = useState<string>("")
  const navigate = useNavigate()

  // ========================================
  // DATA FETCHING
  // ========================================

  // Fetches statistics data from the API
  const fetchStats = async () => {
    if (!user.token) return

    try {
      setError("")
      await getStats(setStats, user, setUser, setLoading, navigate)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch stats")
    }
  }

  // Fetch stats on component mount
  useEffect(() => {
    fetchStats()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ========================================
  // MEMOIZED CALCULATIONS
  // ========================================

  // Get the most recent stats data point
  const currentStats = useMemo(() => {
    if (!stats?.data_points?.length) return null
    return stats.data_points[stats.data_points.length - 1]
  }, [stats])

  // Generate chart data (memoized for performance) with daily aggregation
  const movieChartData = useMemo(() => {
    return stats?.data_points ? generateMovieChartData(stats.data_points) : []
  }, [stats])

  const seriesChartData = useMemo(() => {
    return stats?.data_points ? generateSeriesChartData(stats.data_points) : []
  }, [stats])

  // Generate storage line chart data (memoized for performance) with daily aggregation
  const storageLineChartData = useMemo(() => {
    return stats?.data_points ? generateStorageLineChartData(stats.data_points) : []
  }, [stats])

  const storageChartData = useMemo(() => {
    return currentStats ? generateStorageChartData(currentStats) : []
  }, [currentStats])

  // Calculate chart max values using daily aggregated data
  const dailyAggregatedData = useMemo(() => {
    return stats?.data_points ? aggregateDataByDay(stats.data_points) : []
  }, [stats])

  const movieChartMax = useMemo(() => {
    return dailyAggregatedData.length ? calculateChartMaxValue(dailyAggregatedData, 'movies') : 100
  }, [dailyAggregatedData])

  const seriesChartMax = useMemo(() => {
    return dailyAggregatedData.length ? calculateChartMaxValue(dailyAggregatedData, 'series') : 100
  }, [dailyAggregatedData])

  // Calculate storage chart max value (minimum 1 TB floor)
  const storageLineChartMax = useMemo(() => {
    return dailyAggregatedData.length ? calculateStorageChartMaxValue(dailyAggregatedData) : Math.pow(1024, 4)
  }, [dailyAggregatedData])

  // Generate evenly spaced Y-axis ticks with the top tick being the exact max
  const storageTickValues = useMemo(() => {
    return generateStorageTickValues(storageLineChartMax)
  }, [storageLineChartMax])

  // Calculate optimal tick count for daily data (max 30 days)
  const tickCount = useMemo(() => {
    const dailyDataLength = dailyAggregatedData.length
    return dailyDataLength ? Math.min(6, Math.max(3, Math.ceil(dailyDataLength / 5))) : 4
  }, [dailyAggregatedData.length])

  // ========================================
  // MAIN RENDER
  // ========================================

  return (
    <main>
      <div className="stats-page">
        {/* Error Display */}
        {error && (
          <Alert severity="error" className="stats-error">
            {error}
          </Alert>
        )}

        {/* Loading State */}
        {loading ? (
          <div className="stats-loading">
            <CircularProgress />
          </div>
        ) : currentStats ? (
            <div className="stats-charts grid-layout-graphs">
              {/* Storage Line Chart */}
              <Graph
                title="Storage"
                icon="💾"
                subtitle={`${currentStats.storage.used_percentage.toFixed(1)}%`}
                legendItems={storageLegendItems}

              >
                <Line
                  data={storageLineChartData}
                  maxValue={storageLineChartMax}
                  yAxisLabel="Storage"
                  yAxisFormat={(v: number) => formatStorage(v)}
                  yAxisTickValues={storageTickValues}
                  tooltip={StorageChartTooltip}
                  tickCount={tickCount}
                />
              </Graph>

              {/* Storage Pie Chart */}
              <Graph
                title="Storage Usage"
                icon="💾"

              >
                <Pie data={storageChartData} />
              </Graph>

              {/* Movies Line Chart */}
              <Graph
                title="Movies"
                icon="https://radarr.video/img/logo.png"
                subtitle={`${currentStats.movies.downloaded}`}
                legendItems={legendItems}

              >
                <Line
                  data={movieChartData}
                  maxValue={movieChartMax}
                  tickCount={tickCount}
                />
              </Graph>

              {/* Series Line Chart */}
              <Graph
                title="Series"
                icon="https://sonarr.tv/img/logo.png"
                subtitle={`${currentStats.series.downloaded}`}
                legendItems={legendItems}

              >
                <Line
                  data={seriesChartData}
                  maxValue={seriesChartMax}
                  tickCount={tickCount}
                />
              </Graph>
            </div>
        ) : (
          /* No Data State */
          <div className="stats-empty">
            <h6>No stats data available yet</h6>
            <p>Stats will appear once Automatarr starts collecting data from your loops.</p>
          </div>
        )}
      </div>
      <Footer />
    </main>
  )
}

export default Stats
