import React, { useContext, useEffect, useState, useMemo } from "react"
import { 
  CircularProgress,
  Alert,
  useTheme,
  useMediaQuery
} from "@mui/material"
import { ResponsiveLine, PointTooltipProps } from '@nivo/line'
import { ResponsivePie } from '@nivo/pie'
import AppContext from "../context"
import Footer from "../components/footer/Footer"
import { getStats } from "../shared/requests/statsRequests"
import { StatsType, NivoLineData } from "../types/statsType"
import { useNavigate } from "react-router-dom"
import {
  formatStorage,
  calculateChartMaxValue,
  generateMovieChartData,
  generateSeriesChartData,
  generateStorageChartData,
  getChartTheme,
  getLineLegendConfig,
  aggregateDataByDay
} from "../shared/statsUtilities"

// ========================================
// CHART COMPONENTS
// ========================================

/**
 * Common chart tooltip component with proper Nivo typing
 * @param props - Tooltip props with point data from Nivo
 * @returns JSX tooltip element
 */
const ChartTooltip: React.FC<PointTooltipProps> = ({ point }) => (
  <div
    style={{
      background: '#0f0f0f',
      padding: '9px 12px',
      border: 'none',
      borderRadius: '4px',
      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
    }}
  >
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

  /**
   * Fetches statistics data from the API
   */
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

  // Stable dependency keys to avoid infinite loops

  // Generate chart data (memoized for performance) - now uses daily aggregation
  const movieChartData = useMemo(() => {
    return stats?.data_points ? generateMovieChartData(stats.data_points) : []
  }, [stats])

  const seriesChartData = useMemo(() => {
    return stats?.data_points ? generateSeriesChartData(stats.data_points) : []
  }, [stats])

  const storageChartData = useMemo(() => {
    return currentStats ? generateStorageChartData(currentStats) : []
  }, [currentStats])

  // Calculate chart max values using daily aggregated data (memoized for performance)
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

  /**
   * Renders a responsive line chart with common configuration
   * @param data - Chart data series
   * @param maxValue - Maximum Y-axis value
   * @param title - Chart title
   * @returns JSX element for the line chart
   */
  const renderLineChart = (
    data: NivoLineData[], 
    maxValue: number, 
    title: string
  ) => (
    <div style={{
      backgroundColor: '#0f0f0f',
      padding: '16px',
      borderRadius: '4px',
      border: 'none',
      ...(isMobile && {
        width: '100vw',
        marginLeft: 'calc(-50vw + 50%)',
        borderRadius: 0
      })
    }}>
      <div style={{ padding: '0 48px' }}>
        <h6 style={{ color: 'white', margin: '0', fontSize: '1.25rem' }}>
          {title}
        </h6>
      </div>
      <div style={{ height: isMobile ? '250px' : '400px' }}>
        <ResponsiveLine
          data={data}
          margin={{ 
            top: 50, 
            right: isMobile ? 60 : 110, // Add more right padding on mobile for balance
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
          legends={isMobile ? [] : getLineLegendConfig()} // Hide legends on mobile
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
          <Alert severity="error" style={{ marginBottom: '24px' }}>
            {error}
          </Alert>
        )}

        {/* Loading State */}
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', margin: '40px 0' }}>
            <CircularProgress />
          </div>
        ) : currentStats ? (
          <>
            {/* Current Stats Summary Cards */}
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', 
              gap: isMobile ? '0' : '24px', 
              marginBottom: isMobile ? '0' : '24px' // Remove bottom margin on mobile to avoid double spacing
            }}>
              {/* Movies Summary */}
              <div style={{
                backgroundColor: '#0f0f0f',
                padding: '16px',
                borderRadius: '4px',
                border: 'none',
                ...(isMobile && {
                  width: '100vw',
                  marginLeft: 'calc(-50vw + 50%)',
                  borderRadius: 0,
                  marginBottom: '24px'
                })
              }}>
                <h6 style={{ color: '#90caf9', margin: '0 0 8px 0', fontSize: '1.25rem' }}>🎬 Movies</h6>
                <h4 style={{ color: 'white', margin: '0 0 8px 0', fontSize: '2.125rem' }}>
                  {currentStats.movies.downloaded}
                </h4>
                <p style={{ color: 'rgba(255, 255, 255, 0.7)', margin: '0', fontSize: '0.875rem' }}>
                  Downloaded • {currentStats.movies.queued} queued • {currentStats.movies.deleted} deleted
                </p>
              </div>
              
              {/* Series Summary */}
              <div style={{
                backgroundColor: '#0f0f0f',
                padding: '16px',
                borderRadius: '4px',
                border: 'none',
                ...(isMobile && {
                  width: '100vw',
                  marginLeft: 'calc(-50vw + 50%)',
                  borderRadius: 0,
                  marginBottom: '24px'
                })
              }}>
                <h6 style={{ color: '#90caf9', margin: '0 0 8px 0', fontSize: '1.25rem' }}>📺 Series</h6>
                <h4 style={{ color: 'white', margin: '0 0 8px 0', fontSize: '2.125rem' }}>
                  {currentStats.series.downloaded}
                </h4>
                <p style={{ color: 'rgba(255, 255, 255, 0.7)', margin: '0', fontSize: '0.875rem' }}>
                  Downloaded • {currentStats.series.queued} queued • {currentStats.series.episodes_downloaded} episodes
                </p>
              </div>
              
              {/* Storage Summary */}
              <div style={{
                backgroundColor: '#0f0f0f',
                padding: '16px',
                borderRadius: '4px',
                border: 'none',
                ...(isMobile && {
                  width: '100vw',
                  marginLeft: 'calc(-50vw + 50%)',
                  borderRadius: 0,
                  marginBottom: '24px'
                })
              }}>
                <h6 style={{ color: '#90caf9', margin: '0 0 8px 0', fontSize: '1.25rem' }}>💾 Storage</h6>
                <h4 style={{ color: 'white', margin: '0 0 8px 0', fontSize: '2.125rem' }}>
                  {currentStats.storage.used_percentage.toFixed(1)}%
                </h4>
                <p style={{ color: 'rgba(255, 255, 255, 0.7)', margin: '0', fontSize: '0.875rem' }}>
                  Used • {formatStorage(currentStats.storage.free_storage)} free
                  {currentStats.storage.storage_consistency === 'inconsistent' ? ' ⚠️' : ''}
                </p>
              </div>
            </div>

            {/* Charts Section */}
            <div style={{ 
              display: 'flex',
              flexDirection: 'column',
              gap: isMobile ? '0' : '24px'
            }}>
              
              {/* Movies Line Chart */}
              <div style={{ ...(isMobile && { marginBottom: '24px' }) }}>
                {renderLineChart(movieChartData, movieChartMax, "Movies")}
              </div>

              {/* Series Line Chart */}
              <div style={{ ...(isMobile && { marginBottom: '24px' }) }}>
                {renderLineChart(seriesChartData, seriesChartMax, "Series")}
              </div>

              {/* Storage Pie Chart */}
              <div style={{
                backgroundColor: '#0f0f0f',
                padding: '16px',
                borderRadius: '4px',
                border: 'none',
                ...(isMobile && {
                  width: '100vw',
                  marginLeft: 'calc(-50vw + 50%)',
                  borderRadius: 0
                })
              }}>
                <div style={{ padding: '0 48px' }}>
                  <h6 style={{ color: 'white', margin: '0', fontSize: '1.25rem' }}>
                    Storage Usage
                  </h6>
                </div>
                <div style={{ height: isMobile ? '250px' : '400px' }}>
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
          <div style={{
            backgroundColor: '#0f0f0f',
            padding: '24px',
            borderRadius: '4px',
            border: 'none',
            textAlign: 'center'
          }}>
            <h6 style={{ color: 'rgba(255, 255, 255, 0.7)', margin: '0 0 16px 0', fontSize: '1.25rem' }}>
              No stats data available yet
            </h6>
            <p style={{ color: 'rgba(255, 255, 255, 0.7)', margin: '0', fontSize: '0.875rem' }}>
              Stats will appear once Automatarr starts collecting data from your loops.
            </p>
          </div>
        )}
      </div>
      <Footer />
    </main>
  )
}

export default Stats