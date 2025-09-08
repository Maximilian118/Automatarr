import React, { useEffect, useState, useContext } from "react"
import { useNavigate } from "react-router-dom"
import AppContext from "../context"
import Footer from "../components/footer/footer"
import CenteredLoading from "../components/utility/CenteredLoading/CenteredLoading"
import { getStats, StatsType } from "../shared/requests/statsRequests"
import UserPoolManager from "../components/UserPoolManager/UserPoolManager"
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts"
import { Paper, Typography, Box, Grid, Card, CardContent, Chip } from "@mui/material"
import { format, parseISO } from "date-fns"
import MovieIcon from '@mui/icons-material/Movie'
import TvIcon from '@mui/icons-material/Tv'
import DownloadIcon from '@mui/icons-material/Download'
import DeleteIcon from '@mui/icons-material/Delete'
import StorageIcon from '@mui/icons-material/Storage'
import SpeedIcon from '@mui/icons-material/Speed'

const Stats: React.FC = () => {
  const { user, setUser, loading, setLoading } = useContext(AppContext)
  const navigate = useNavigate()
  const [stats, setStats] = useState<StatsType | undefined>(undefined)
  const [refreshInterval, setRefreshInterval] = useState<NodeJS.Timeout | null>(null)

  const fetchStats = async () => {
    const statsData = await getStats(user, setUser, navigate, setLoading)
    if (statsData) {
      setStats(statsData)
    }
  }

  useEffect(() => {
    fetchStats()
    
    const interval = setInterval(() => {
      fetchStats()
    }, 3600000)
    
    setRefreshInterval(interval)
    
    return () => {
      if (refreshInterval) {
        clearInterval(refreshInterval)
      }
    }
  }, [])

  if (loading || !stats) {
    return (
      <main>
        <CenteredLoading />
        <Footer />
      </main>
    )
  }

  const formatBytes = (bytes: number) => {
    const gb = bytes / (1024 * 1024 * 1024)
    return `${gb.toFixed(2)} GB`
  }

  const formatBandwidth = (bytesPerSec: number) => {
    const mbps = (bytesPerSec * 8) / (1024 * 1024)
    return `${mbps.toFixed(2)} Mbps`
  }

  const hourlyDownloadData = stats.hourlyStats.slice(-24).map((stat) => ({
    hour: format(parseISO(stat.hour), "HH:mm"),
    movies: stat.downloaded.movies,
    series: stat.downloaded.series,
    episodes: stat.downloaded.episodes,
  }))

  const hourlyDeleteData = stats.hourlyStats.slice(-24).map((stat) => ({
    hour: format(parseISO(stat.hour), "HH:mm"),
    movies: stat.deleted.movies,
    series: stat.deleted.series,
    episodes: stat.deleted.episodes,
  }))

  const bandwidthData = stats.hourlyStats.slice(-24).map((stat) => ({
    hour: format(parseISO(stat.hour), "HH:mm"),
    bandwidth: stat.averageBandwidth / (1024 * 1024),
  }))

  const diskUsageData = stats.hourlyStats.slice(-24).map((stat) => ({
    hour: format(parseISO(stat.hour), "HH:mm"),
    usage: stat.averageDiskUsage / (1024 * 1024 * 1024),
  }))

  const downloadActivityData = stats.hourlyStats.slice(-24).map((stat) => ({
    hour: format(parseISO(stat.hour), "HH:mm"),
    active: stat.peakActiveDownloads,
  }))

  const currentMediaPie = [
    { name: "Movies", value: stats.currentSnapshot.downloaded.movies, color: "#8884d8" },
    { name: "Series", value: stats.currentSnapshot.downloaded.series, color: "#82ca9d" },
    { name: "Episodes", value: stats.currentSnapshot.downloaded.episodes, color: "#ffc658" },
  ]

  const downloadQueuePie = [
    { name: "Active", value: stats.currentSnapshot.activeDownloads, color: "#4caf50" },
    { name: "Queued", value: stats.currentSnapshot.queuedDownloads, color: "#ff9800" },
    { name: "Failed", value: stats.currentSnapshot.failedDownloads, color: "#f44336" },
  ]

  return (
    <main style={{ padding: "20px" }}>
      <Typography variant="h4" gutterBottom>
        Media Statistics Dashboard
      </Typography>
      
      <Grid container spacing={3}>
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography color="textSecondary" gutterBottom>
                    Total Movies
                  </Typography>
                  <Typography variant="h4">
                    {stats.currentSnapshot.downloaded.movies}
                  </Typography>
                </Box>
                <MovieIcon fontSize="large" color="primary" />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography color="textSecondary" gutterBottom>
                    Total Series
                  </Typography>
                  <Typography variant="h4">
                    {stats.currentSnapshot.downloaded.series}
                  </Typography>
                </Box>
                <TvIcon fontSize="large" color="primary" />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography color="textSecondary" gutterBottom>
                    Disk Usage
                  </Typography>
                  <Typography variant="h5">
                    {formatBytes(stats.currentSnapshot.diskUsage)}
                  </Typography>
                </Box>
                <StorageIcon fontSize="large" color="primary" />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography color="textSecondary" gutterBottom>
                    Bandwidth
                  </Typography>
                  <Typography variant="h5">
                    {formatBandwidth(stats.currentSnapshot.totalBandwidth)}
                  </Typography>
                </Box>
                <SpeedIcon fontSize="large" color="primary" />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} lg={6}>
          <Paper elevation={3} style={{ padding: "20px" }}>
            <Typography variant="h6" gutterBottom>
              <DownloadIcon /> Downloaded Media (Last 24 Hours)
            </Typography>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={hourlyDownloadData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="hour" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="movies" stroke="#8884d8" name="Movies" />
                <Line type="monotone" dataKey="series" stroke="#82ca9d" name="Series" />
                <Line type="monotone" dataKey="episodes" stroke="#ffc658" name="Episodes" />
              </LineChart>
            </ResponsiveContainer>
          </Paper>
        </Grid>

        <Grid item xs={12} lg={6}>
          <Paper elevation={3} style={{ padding: "20px" }}>
            <Typography variant="h6" gutterBottom>
              <DeleteIcon /> Deleted Media (Last 24 Hours)
            </Typography>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={hourlyDeleteData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="hour" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="movies" fill="#8884d8" name="Movies" />
                <Bar dataKey="series" fill="#82ca9d" name="Series" />
                <Bar dataKey="episodes" fill="#ffc658" name="Episodes" />
              </BarChart>
            </ResponsiveContainer>
          </Paper>
        </Grid>

        <Grid item xs={12} lg={6}>
          <Paper elevation={3} style={{ padding: "20px" }}>
            <Typography variant="h6" gutterBottom>
              Bandwidth Usage (Mbps)
            </Typography>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={bandwidthData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="hour" />
                <YAxis />
                <Tooltip />
                <Area type="monotone" dataKey="bandwidth" stroke="#8884d8" fill="#8884d8" fillOpacity={0.6} />
              </AreaChart>
            </ResponsiveContainer>
          </Paper>
        </Grid>

        <Grid item xs={12} lg={6}>
          <Paper elevation={3} style={{ padding: "20px" }}>
            <Typography variant="h6" gutterBottom>
              Disk Usage Over Time (GB)
            </Typography>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={diskUsageData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="hour" />
                <YAxis />
                <Tooltip />
                <Area type="monotone" dataKey="usage" stroke="#82ca9d" fill="#82ca9d" fillOpacity={0.6} />
              </AreaChart>
            </ResponsiveContainer>
          </Paper>
        </Grid>

        <Grid item xs={12} lg={4}>
          <Paper elevation={3} style={{ padding: "20px" }}>
            <Typography variant="h6" gutterBottom>
              Media Distribution
            </Typography>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={currentMediaPie}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={(entry) => `${entry.name}: ${entry.value}`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {currentMediaPie.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </Paper>
        </Grid>

        <Grid item xs={12} lg={4}>
          <Paper elevation={3} style={{ padding: "20px" }}>
            <Typography variant="h6" gutterBottom>
              Download Queue Status
            </Typography>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={downloadQueuePie}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={(entry) => `${entry.name}: ${entry.value}`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {downloadQueuePie.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </Paper>
        </Grid>

        <Grid item xs={12} lg={4}>
          <Paper elevation={3} style={{ padding: "20px" }}>
            <Typography variant="h6" gutterBottom>
              Download Activity
            </Typography>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={downloadActivityData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="hour" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="active" fill="#ff9800" name="Active Downloads" />
              </BarChart>
            </ResponsiveContainer>
          </Paper>
        </Grid>

        <Grid item xs={12}>
          <Paper elevation={3} style={{ padding: "20px" }}>
            <Box display="flex" justifyContent="space-between" alignItems="center">
              <Typography variant="body2" color="textSecondary">
                Last Updated: {stats.updated_at ? format(parseISO(stats.updated_at), "PPpp") : "Never"}
              </Typography>
              <Chip 
                label="Auto-refresh: Every Hour" 
                color="primary" 
                variant="outlined"
              />
            </Box>
          </Paper>
        </Grid>

        <Grid item xs={12}>
          <UserPoolManager />
        </Grid>
      </Grid>
      
      <Footer />
    </main>
  )
}

export default Stats