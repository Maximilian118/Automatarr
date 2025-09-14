import React, { useMemo, useState, useEffect, useContext } from "react"
import { ResponsiveBar } from "@nivo/bar"
import { BotUserType } from "../../../types/settingsType"
import { StatsType } from "../../../types/statsType"
import { getStats } from "../../../shared/requests/statsRequests"
import AppContext from "../../../context"
import { useNavigate } from "react-router-dom"
import { formatBytes } from "../../../shared/utility"
import NivoLegend from "../NivoLegend/NivoLegend"
import "./storage-chart.scss"

interface StorageChartProps {
  users: BotUserType[]
}

interface StorageData {
  name: string
  [key: string]: number | string
}

const StorageChart: React.FC<StorageChartProps> = ({ users }) => {
  const { user, setUser, setLoading } = useContext(AppContext)
  const [stats, setStats] = useState<StatsType | null>(null)
  const navigate = useNavigate()

  useEffect(() => {
    const fetchStatsData = async () => {
      if (!user.token) return
      
      try {
        await getStats(setStats, user, setUser, setLoading, navigate)
      } catch (error) {
        console.error("Failed to fetch stats for storage chart:", error)
      }
    }

    fetchStatsData()
  }, [user, setUser, setLoading, navigate])

  const { storageData, userKeys, colors, legendData, usersWithStorage } = useMemo(() => {
    const data: StorageData[] = []
    const userKeys: string[] = []
    
    // Generate colors for each user + gray for available (48 unique colors)
    const baseColors = [
      '#ff6b35', '#f7931e', '#ffcd3c', '#c5e063', 
      '#6bcf7f', '#4ecdc4', '#45b7d1', '#5b9bd5',
      '#7c3aed', '#a855f7', '#ec4899', '#ef4444',
      '#10b981', '#f59e0b', '#8b5cf6', '#06b6d4',
      '#84cc16', '#f97316', '#6366f1', '#14b8a6',
      '#eab308', '#d946ef', '#3b82f6', '#22c55e',
      '#f472b6', '#fb923c', '#8a2be2', '#ff69b4',
      '#00ced1', '#32cd32', '#ff4500', '#ba55d3',
      '#20b2aa', '#ff6347', '#4169e1', '#ffa500',
      '#9370db', '#00fa9a', '#ff1493', '#1e90ff',
      '#adff2f', '#ff8c00', '#9932cc', '#ff00ff',
      '#00ff7f', '#dc143c', '#0000ff', '#ff7f50',
      '#da70d6', '#00bfff'
    ]

    // Get the latest storage stats
    const currentStats = stats?.data_points?.[stats.data_points.length - 1]
    const totalDriveSpaceBytes = currentStats?.storage.total_storage || 0
    const freeDriveSpaceBytes = currentStats?.storage.free_storage || 0
    
    // Convert to GB
    const freeDriveSpaceGB = freeDriveSpaceBytes / (1024 ** 3)

    const chartData: { [key: string]: number } = {}
    const userStorages: Array<{ name: string; storage: number; storageBytes: number; index: number }> = []

    // Calculate each user's storage
    users.forEach((user, index) => {
      let userTotalStorage = 0

      // Calculate movies storage
      user.pool.movies.forEach(movie => {
        if (movie.sizeOnDisk) {
          userTotalStorage += movie.sizeOnDisk
        }
      })

      // Calculate series storage
      user.pool.series.forEach(series => {
        if (series.seasons) {
          series.seasons.forEach(season => {
            if (season.statistics && season.statistics.sizeOnDisk) {
              userTotalStorage += season.statistics.sizeOnDisk
            }
          })
        }
      })

      // Convert bytes to GB
      const userStorageGB = userTotalStorage / (1024 ** 3)
      userStorages.push({ name: user.name, storage: userStorageGB, storageBytes: userTotalStorage, index })
    })

    // Filter out users with 0 storage and sort by storage (highest first)
    const usersWithStorage = userStorages.filter(userStorage => userStorage.storage > 0)
    usersWithStorage.sort((a, b) => b.storage - a.storage)

    // Create chart data with sorted users + available space
    usersWithStorage.forEach((userStorage, sortedIndex) => {
      const userKey = `user_${sortedIndex}`
      chartData[userKey] = userStorage.storage // Use actual storage since we filtered out 0s
      userKeys.push(userKey)
    })

    // Add available space
    const availableKey = 'available'
    userKeys.push(availableKey)
    chartData[availableKey] = Math.max(freeDriveSpaceGB, 0.01)

    data.push({
      name: "Storage",
      ...chartData
    })

    // Colors for users + gray for available - cycle through colors if we have more users than colors
    const userColors = usersWithStorage.map((_, index) => 
      baseColors[index % baseColors.length]
    )
    const chartColors = [
      ...userColors,
      '#6b7280' // Gray for available space
    ]

    // Calculate how many legend items can fit in two rows
    const chartWidth = typeof window !== 'undefined' ? window.innerWidth * 0.8 : 1200 // 80vw fallback
    const itemWidth = 180 // px
    const itemSpacing = 14 // px
    const maxItemsPerRow = Math.floor(chartWidth / (itemWidth + itemSpacing))
    const maxTotalItems = maxItemsPerRow * 2 // Two rows maximum
    const reservedSlots = 2 // Reserve slots for "Available" and "Total"
    const availableUserSlots = maxTotalItems - reservedSlots
    
    // Sort users by storage (highest first) and take only what fits
    const sortedUsers = [...usersWithStorage].sort((a, b) => b.storage - a.storage)
    const visibleUsers = sortedUsers.slice(0, availableUserSlots)
    
    // Create legend data - users + available + total
    const legendData = [
      ...visibleUsers.map((userStorage, sortedIndex) => ({
        id: `user_${sortedIndex}`,
        label: `${userStorage.name}: ${formatBytes(userStorage.storageBytes)}`,
        color: chartColors[sortedIndex]
      })),
      {
        id: 'available',
        label: `Available: ${formatBytes(freeDriveSpaceBytes || 0)}`,
        color: chartColors[chartColors.length - 1]
      },
      {
        id: 'total',
        label: `Total: ${formatBytes(totalDriveSpaceBytes || 0)}`,
        color: '#374151'
      }
    ]

    return { 
      storageData: data, 
      userKeys,
      colors: chartColors,
      usersWithStorage,
      totalDriveSpaceBytes,
      freeDriveSpaceBytes,
      legendData
    }
  }, [users, stats])

  return (
    <div className="storage-chart-container">
      <div className="storage-chart">
        <ResponsiveBar
        data={storageData}
        keys={userKeys}
        indexBy="name"
        layout="horizontal"
        margin={{ top: 20, right: 0, bottom: 60, left: 0 }}
        padding={0.1}
        colors={colors}
        borderRadius={4}
        innerPadding={0}
        axisTop={null}
        axisRight={null}
        axisBottom={null}
        axisLeft={null}
        enableLabel={false}
        enableGridX={false}
        enableGridY={false}
        isInteractive={true}
        animate={true}
        tooltip={({ id, color }) => {
          // Find the user for this segment
          const userIndex = parseInt(id.toString().replace('user_', ''))
          const user = usersWithStorage[userIndex]
          
          if (user) {
            return (
              <div
                style={{
                  background: '#0f0f0f',
                  padding: '8px 12px',
                  border: 'none',
                  borderRadius: '4px',
                  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
                  color: '#ffffff',
                  fontSize: '12px'
                }}
              >
                <div style={{ color: color, fontWeight: 'bold', marginBottom: '4px' }}>
                  {user.name}
                </div>
                <div>
                  Storage: {formatBytes(user.storageBytes)}
                </div>
              </div>
            )
          }
          
          return null
        }}
        motionConfig="gentle"
        theme={{
          background: 'transparent'
        }}
        legends={[]}
      />
      <NivoLegend
        data={legendData}
        direction="row"
        itemsSpacing={14}
        itemWidth={180}
        itemHeight={20}
        itemDirection="left-to-right"
        itemOpacity={0.85}
        symbolSize={14}
        symbolShape="circle"
        translateY={-80}
        className="storage-chart-legend"
      />
      </div>
    </div>
  )
}

export default StorageChart