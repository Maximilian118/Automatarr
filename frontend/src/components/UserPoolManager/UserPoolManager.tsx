import React, { useState, useEffect, useContext } from "react"
import {
  Paper,
  Typography,
  Box,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Checkbox,
  Button,
  Alert,
  CircularProgress,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Divider,
} from "@mui/material"
import ExpandMoreIcon from "@mui/icons-material/ExpandMore"
import DeleteIcon from "@mui/icons-material/Delete"
import PersonIcon from "@mui/icons-material/Person"
import MovieIcon from "@mui/icons-material/Movie"
import TvIcon from "@mui/icons-material/Tv"
import AdminPanelSettingsIcon from "@mui/icons-material/AdminPanelSettings"
import SupervisorAccountIcon from "@mui/icons-material/SupervisorAccount"
import { getBotUsers, removeFromBotUserPool } from "../../shared/requests/botUserRequests"
import { BotUserType } from "../../types/settingsType"
import AppContext from "../../context"
import { useNavigate } from "react-router-dom"

const UserPoolManager: React.FC = () => {
  const { user, setUser, loading, setLoading } = useContext(AppContext)
  const navigate = useNavigate()
  const [botUsers, setBotUsers] = useState<BotUserType[]>([])
  const [selectedMovies, setSelectedMovies] = useState<{ [userId: string]: string[] }>({})
  const [selectedSeries, setSelectedSeries] = useState<{ [userId: string]: string[] }>({})
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean
    userId: string
    userName: string
    movieCount: number
    seriesCount: number
  }>({ open: false, userId: "", userName: "", movieCount: 0, seriesCount: 0 })
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  useEffect(() => {
    fetchBotUsers()
  }, [])

  const fetchBotUsers = async () => {
    const users = await getBotUsers(user, setUser, navigate, setLoading)
    if (users) {
      setBotUsers(users)
    } else {
      setError("Failed to fetch bot users")
    }
  }

  const handleMovieToggle = (userId: string, movieId: string) => {
    setSelectedMovies((prev) => {
      const userMovies = prev[userId] || []
      if (userMovies.includes(movieId)) {
        return { ...prev, [userId]: userMovies.filter((id) => id !== movieId) }
      }
      return { ...prev, [userId]: [...userMovies, movieId] }
    })
  }

  const handleSeriesToggle = (userId: string, seriesId: string) => {
    setSelectedSeries((prev) => {
      const userSeries = prev[userId] || []
      if (userSeries.includes(seriesId)) {
        return { ...prev, [userId]: userSeries.filter((id) => id !== seriesId) }
      }
      return { ...prev, [userId]: [...userSeries, seriesId] }
    })
  }

  const handleRemoveSelected = (userId: string, userName: string) => {
    const movieCount = selectedMovies[userId]?.length || 0
    const seriesCount = selectedSeries[userId]?.length || 0

    if (movieCount === 0 && seriesCount === 0) {
      setError("Please select at least one item to remove")
      return
    }

    setConfirmDialog({
      open: true,
      userId,
      userName,
      movieCount,
      seriesCount,
    })
  }

  const confirmRemoval = async () => {
    const { userId } = confirmDialog
    const movieIds = selectedMovies[userId] || []
    const seriesIds = selectedSeries[userId] || []

    const updatedUser = await removeFromBotUserPool(
      user,
      setUser,
      navigate,
      setLoading,
      userId,
      movieIds,
      seriesIds
    )

    if (updatedUser) {
      // Update the local state with the updated user
      setBotUsers((prev) =>
        prev.map((u) => (u._id === userId ? updatedUser : u))
      )
      // Clear selections
      setSelectedMovies((prev) => ({ ...prev, [userId]: [] }))
      setSelectedSeries((prev) => ({ ...prev, [userId]: [] }))
      setSuccess(
        `Successfully removed ${confirmDialog.movieCount} movie(s) and ${confirmDialog.seriesCount} series from ${confirmDialog.userName}'s pool`
      )
    } else {
      setError("Failed to remove items from user pool")
    }

    setConfirmDialog({ open: false, userId: "", userName: "", movieCount: 0, seriesCount: 0 })
  }

  const selectAllMovies = (userId: string, movies: any[]) => {
    const allMovieIds = movies.map((m) => m.id || m.tmdbId).filter(Boolean)
    setSelectedMovies((prev) => ({ ...prev, [userId]: allMovieIds }))
  }

  const selectAllSeries = (userId: string, series: any[]) => {
    const allSeriesIds = series.map((s) => s.id || s.tvdbId).filter(Boolean)
    setSelectedSeries((prev) => ({ ...prev, [userId]: allSeriesIds }))
  }

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" p={3}>
        <CircularProgress />
      </Box>
    )
  }

  return (
    <Paper elevation={3} style={{ padding: "20px", marginTop: "20px" }}>
      <Box display="flex" alignItems="center" mb={2}>
        <PersonIcon style={{ marginRight: "10px" }} />
        <Typography variant="h5">User Pool Management</Typography>
      </Box>

      {error && (
        <Alert severity="error" onClose={() => setError(null)} style={{ marginBottom: "10px" }}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert severity="success" onClose={() => setSuccess(null)} style={{ marginBottom: "10px" }}>
          {success}
        </Alert>
      )}

      {botUsers.length === 0 ? (
        <Typography color="textSecondary">No bot users found</Typography>
      ) : (
        botUsers.map((botUser) => (
          <Accordion key={botUser._id}>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Box display="flex" alignItems="center" gap={1} width="100%">
                <Typography variant="h6">{botUser.name}</Typography>
                {botUser.admin && (
                  <Chip
                    icon={<AdminPanelSettingsIcon />}
                    label="Admin"
                    size="small"
                    color="primary"
                  />
                )}
                {botUser.super_user && (
                  <Chip
                    icon={<SupervisorAccountIcon />}
                    label="Super User"
                    size="small"
                    color="secondary"
                  />
                )}
                <Box ml="auto" mr={2}>
                  <Chip
                    icon={<MovieIcon />}
                    label={`${botUser.pool?.movies?.length || 0} Movies`}
                    size="small"
                    variant="outlined"
                  />
                  <Chip
                    icon={<TvIcon />}
                    label={`${botUser.pool?.series?.length || 0} Series`}
                    size="small"
                    variant="outlined"
                    style={{ marginLeft: "8px" }}
                  />
                </Box>
              </Box>
            </AccordionSummary>
            <AccordionDetails>
              <Box>
                {/* Movies Section */}
                {botUser.pool?.movies && botUser.pool.movies.length > 0 && (
                  <>
                    <Box display="flex" alignItems="center" justifyContent="space-between" mb={1}>
                      <Typography variant="subtitle1" style={{ fontWeight: "bold" }}>
                        <MovieIcon style={{ verticalAlign: "middle", marginRight: "5px" }} />
                        Movies ({botUser.pool.movies.length})
                      </Typography>
                      <Button
                        size="small"
                        onClick={() => selectAllMovies(botUser._id!, botUser.pool.movies)}
                      >
                        Select All
                      </Button>
                    </Box>
                    <List dense>
                      {botUser.pool.movies.map((movie) => {
                        const movieId = movie.id || movie.tmdbId
                        const isSelected = selectedMovies[botUser._id!]?.includes(movieId) || false
                        return (
                          <ListItem key={movieId}>
                            <Checkbox
                              edge="start"
                              checked={isSelected}
                              onChange={() => handleMovieToggle(botUser._id!, movieId)}
                            />
                            <ListItemText
                              primary={movie.title}
                              secondary={movie.year ? `(${movie.year})` : undefined}
                            />
                          </ListItem>
                        )
                      })}
                    </List>
                    <Divider style={{ margin: "10px 0" }} />
                  </>
                )}

                {/* Series Section */}
                {botUser.pool?.series && botUser.pool.series.length > 0 && (
                  <>
                    <Box display="flex" alignItems="center" justifyContent="space-between" mb={1}>
                      <Typography variant="subtitle1" style={{ fontWeight: "bold" }}>
                        <TvIcon style={{ verticalAlign: "middle", marginRight: "5px" }} />
                        Series ({botUser.pool.series.length})
                      </Typography>
                      <Button
                        size="small"
                        onClick={() => selectAllSeries(botUser._id!, botUser.pool.series)}
                      >
                        Select All
                      </Button>
                    </Box>
                    <List dense>
                      {botUser.pool.series.map((series) => {
                        const seriesId = series.id || series.tvdbId
                        const isSelected = selectedSeries[botUser._id!]?.includes(seriesId) || false
                        return (
                          <ListItem key={seriesId}>
                            <Checkbox
                              edge="start"
                              checked={isSelected}
                              onChange={() => handleSeriesToggle(botUser._id!, seriesId)}
                            />
                            <ListItemText
                              primary={series.title}
                              secondary={series.year ? `(${series.year})` : undefined}
                            />
                          </ListItem>
                        )
                      })}
                    </List>
                  </>
                )}

                {/* Action Buttons */}
                <Box display="flex" justifyContent="flex-end" mt={2}>
                  <Button
                    variant="contained"
                    color="error"
                    startIcon={<DeleteIcon />}
                    onClick={() => handleRemoveSelected(botUser._id!, botUser.name)}
                    disabled={
                      (!selectedMovies[botUser._id!] || selectedMovies[botUser._id!].length === 0) &&
                      (!selectedSeries[botUser._id!] || selectedSeries[botUser._id!].length === 0)
                    }
                  >
                    Remove Selected Items
                  </Button>
                </Box>
              </Box>
            </AccordionDetails>
          </Accordion>
        ))
      )}

      {/* Confirmation Dialog */}
      <Dialog open={confirmDialog.open} onClose={() => setConfirmDialog({ ...confirmDialog, open: false })}>
        <DialogTitle>Confirm Removal</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to remove {confirmDialog.movieCount} movie(s) and{" "}
            {confirmDialog.seriesCount} series from {confirmDialog.userName}'s pool?
          </Typography>
          <Typography variant="body2" color="error" style={{ marginTop: "10px" }}>
            This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDialog({ ...confirmDialog, open: false })}>Cancel</Button>
          <Button onClick={confirmRemoval} color="error" variant="contained">
            Remove
          </Button>
        </DialogActions>
      </Dialog>
    </Paper>
  )
}

export default UserPoolManager