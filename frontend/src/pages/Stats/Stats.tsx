import React, { useContext, useEffect, useState, useMemo } from "react"
import {
  CircularProgress,
  Alert,
  useTheme,
  useMediaQuery
} from "@mui/material"
import { ResponsiveLine, PointTooltipProps } from '@nivo/line'
import { ResponsivePie } from '@nivo/pie'
import AppContext from "../../context"
import Footer from "../../components/footer/Footer"
import { getStats } from "../../shared/requests/statsRequests"
import { StatsType, NivoLineData } from "../../types/statsType"
import { useNavigate } from "react-router-dom"
import {
  formatStorage,
  calculateChartMaxValue,
  generateMovieChartData,
  generateSeriesChartData,
  generateStorageChartData,
  getChartTheme,
  aggregateDataByDay
} from "../../shared/statsUtilities"
import "./_stats.scss"

// ========================================
// CONSTANTS
// ========================================

// Legend items for line charts
const legendItems = [
  { label: 'Downloaded', color: '#4CAF50' },
  { label: 'Queued', color: '#FF9800' },
  { label: 'Deleted', color: '#F44336' },
]

// ========================================
// CHART COMPONENTS
// ========================================

// Tooltip shown on chart point hover
const ChartTooltip: React.FC<PointTooltipProps> = ({ point }) => (
  <div className="stats-card">
    <div style={{ color: point.serieColor, fontWeight: 'bold' }}>
      {point.serieId}: {point.data.yFormatted}
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
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('md'))

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

  // Calculate optimal tick count for daily data (max 30 days)
  const tickCount = useMemo(() => {
    const dailyDataLength = dailyAggregatedData.length
    return dailyDataLength ? Math.min(6, Math.max(3, Math.ceil(dailyDataLength / 5))) : 4
  }, [dailyAggregatedData.length])

  // ========================================
  // RENDER HELPERS
  // ========================================

  // Renders a responsive line chart with icon, title, and inline legend
  const renderLineChart = (
    data: NivoLineData[],
    maxValue: number,
    title: string,
    icon: string
  ) => (
    <div className={`stats-card ${isMobile ? 'stats-card-mobile' : ''}`}>
      {/* Chart header with icon, title, and legend */}
      <div className="stats-chart-header">
        <div className="stats-chart-title">
          <img src={icon} alt={title} />
          <h6>{title}</h6>
        </div>
        <div className="stats-chart-legend">
          {legendItems.map(item => (
            <div key={item.label} className="stats-legend-item">
              <span className="stats-legend-dot" style={{ backgroundColor: item.color }} />
              <span className="stats-legend-label">{item.label}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="stats-chart-container">
        <ResponsiveLine
          data={data}
          margin={{
            top: 50,
            right: 30,
            bottom: 50,
            left: 60
          }}
          xScale={{ type: 'point' }}
          yScale={{
            type: 'linear',
            min: 0,
            max: maxValue,
            stacked: false,
            reverse: false
          }}
          curve="monotoneX"
          axisTop={null}
          axisRight={null}
          axisBottom={{
            tickSize: 5,
            tickPadding: 5,
            tickRotation: isMobile ? -45 : 0,
            tickValues: tickCount,
            legend: 'Day',
            legendOffset: 36,
            legendPosition: 'middle'
          }}
          axisLeft={{
            tickSize: 5,
            tickPadding: 5,
            tickRotation: 0,
            legend: 'Count',
            legendOffset: -40,
            legendPosition: 'middle'
          }}
          colors={{ datum: 'color' }}
          pointSize={0}
          enablePoints={false}
          useMesh={true}
          tooltip={ChartTooltip}
          legends={[]}
          theme={getChartTheme(theme)}
        />
      </div>
    </div>
  )

  // ========================================
  // MAIN RENDER
  // ========================================

  return (
    <main>
      <div>
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
          <>
            {/* Current Stats Summary Cards */}
            <div className="stats-summary">
              {/* Movies Summary */}
              <div className={`stats-card ${isMobile ? 'stats-card-mobile' : ''}`}>
                <h6 className="stats-summary-title">🎬 Movies</h6>
                <h4 className="stats-summary-value">
                  {currentStats.movies.downloaded}
                </h4>
                <p className="stats-summary-detail">
                  Downloaded • {currentStats.movies.queued} queued • {currentStats.movies.deleted} deleted
                </p>
              </div>

              {/* Series Summary */}
              <div className={`stats-card ${isMobile ? 'stats-card-mobile' : ''}`}>
                <h6 className="stats-summary-title">📺 Series</h6>
                <h4 className="stats-summary-value">
                  {currentStats.series.downloaded}
                </h4>
                <p className="stats-summary-detail">
                  Downloaded • {currentStats.series.queued} queued • {currentStats.series.episodes_downloaded} episodes
                </p>
              </div>

              {/* Storage Summary */}
              <div className={`stats-card ${isMobile ? 'stats-card-mobile' : ''}`}>
                <h6 className="stats-summary-title">💾 Storage</h6>
                <h4 className="stats-summary-value">
                  {currentStats.storage.used_percentage.toFixed(1)}%
                </h4>
                <p className="stats-summary-detail">
                  Used • {formatStorage(currentStats.storage.free_storage)} free
                  {currentStats.storage.storage_consistency === 'inconsistent' ? ' ⚠️' : ''}
                </p>
              </div>
            </div>

            {/* Charts Section */}
            <div className="stats-charts">
              {/* Movies Line Chart */}
              <div className={isMobile ? 'stats-chart-wrapper' : ''}>
                {renderLineChart(movieChartData, movieChartMax, "Movies", "https://radarr.video/img/logo.png")}
              </div>

              {/* Series Line Chart */}
              <div className={isMobile ? 'stats-chart-wrapper' : ''}>
                {renderLineChart(seriesChartData, seriesChartMax, "Series", "https://sonarr.tv/img/logo.png")}
              </div>

              {/* Storage Pie Chart */}
              <div className={`stats-card ${isMobile ? 'stats-card-mobile' : ''}`}>
                <div className="stats-pie-title">
                  <h6>Storage Usage</h6>
                </div>
                <div className="stats-chart-container">
                  <ResponsivePie
                    data={storageChartData}
                    margin={{ top: 40, right: 80, bottom: 80, left: 80 }}
                    innerRadius={0.5}
                    padAngle={0.7}
                    cornerRadius={3}
                    activeOuterRadiusOffset={8}
                    borderWidth={1}
                    borderColor={{ from: 'color', modifiers: [['darker', 0.2]] }}
                    arcLinkLabelsSkipAngle={10}
                    arcLinkLabelsTextColor={theme.palette.text.primary}
                    arcLinkLabelsThickness={2}
                    arcLinkLabelsColor={{ from: 'color' }}
                    arcLabelsSkipAngle={10}
                    arcLabelsTextColor={{ from: 'color', modifiers: [['darker', 2]] }}
                    legends={[
                      {
                        anchor: 'bottom',
                        direction: 'row',
                        justify: false,
                        translateX: 0,
                        translateY: 56,
                        itemsSpacing: 0,
                        itemWidth: 100,
                        itemHeight: 18,
                        itemTextColor: theme.palette.text.primary,
                        itemDirection: 'left-to-right',
                        itemOpacity: 1,
                        symbolSize: 18,
                        symbolShape: 'circle',
                        effects: [
                          {
                            on: 'hover',
                            style: { itemTextColor: theme.palette.primary.main }
                          }
                        ]
                      }
                    ]}
                  />
                </div>
              </div>
            </div>
          </>
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
