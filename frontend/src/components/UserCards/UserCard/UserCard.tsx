import React, { useState } from "react"
import { CardContent, Chip, IconButton, Button, Collapse, Typography } from "@mui/material"
import { Clear, MovieRounded, TvRounded, CheckCircle, Settings } from "@mui/icons-material"
import { BotUserType, settingsType } from "../../../types/settingsType"
import { removePoolItem, deleteUser, updateUserStatus, updateUserOverwrites } from "../../../shared/requests/settingsRequests"
import Toggle from "../../utility/Toggle/Toggle"
import MUIAutocomplete from "../../utility/MUIAutocomplete/MUIAutocomplete"
import { userOverwriteSelection, userOverwriteToNumber, numberToUserOverwriteString, formatBytes } from "../../../shared/utility"
import "./user-card.scss"

const calculateUserMovieLimit = (user: BotUserType, settings: settingsType): string => {
  if (user.admin) return "∞"
  if (user.max_movies_overwrite != null) return user.max_movies_overwrite.toString()
  
  const generalMax = settings.general_bot.max_movies
  if (generalMax == null) return "∞"
  
  const effectiveMax = user.super_user ? generalMax * 2 : generalMax
  return effectiveMax.toString()
}

const calculateUserSeriesLimit = (user: BotUserType, settings: settingsType): string => {
  if (user.admin) return "∞"
  if (user.max_series_overwrite != null) return user.max_series_overwrite.toString()
  
  const generalMax = settings.general_bot.max_series
  if (generalMax == null) return "∞"
  
  const effectiveMax = user.super_user ? generalMax * 2 : generalMax
  return effectiveMax.toString()
}

const calculateUserTotalStorage = (user: BotUserType): string => {
  let totalBytes = 0

  // Add storage from all movies
  user.pool.movies.forEach(movie => {
    if (movie.sizeOnDisk) {
      totalBytes += movie.sizeOnDisk
    }
  })

  // Add storage from all series (sum of all season statistics)
  user.pool.series.forEach(series => {
    if (series.seasons) {
      series.seasons.forEach(season => {
        if (season.statistics && season.statistics.sizeOnDisk) {
          totalBytes += season.statistics.sizeOnDisk
        }
      })
    }
  })

  return formatBytes(totalBytes)
}

interface RemovalState {
  itemType: 'movies' | 'series'
  itemIndex: number
  confirming: boolean
}

interface UserCardProps {
  user: BotUserType
  settings: settingsType
  onSettingsUpdate: (newSettings: settingsType) => void
  isOwner?: boolean
}

const UserCard: React.FC<UserCardProps> = ({ user, settings, onSettingsUpdate, isOwner }) => {
  const [removalState, setRemovalState] = useState<RemovalState | null>(null)
  const [removing, setRemoving] = useState(false)
  const [contentType, setContentType] = useState<'movies' | 'series'>('movies')
  const [settingsMode, setSettingsMode] = useState<'normal' | 'settings' | 'confirm'>('normal')
  const [deleting, setDeleting] = useState(false)
  const [hoveredItem, setHoveredItem] = useState<number | null>(null)

  const getItemStorage = (item: any, itemType: 'movies' | 'series'): string => {
    if (itemType === 'movies') {
      return formatBytes(item.sizeOnDisk || 0)
    } else {
      // For series, calculate total size from all seasons
      let totalBytes = 0
      if (item.seasons) {
        item.seasons.forEach((season: any) => {
          if (season.statistics && season.statistics.sizeOnDisk) {
            totalBytes += season.statistics.sizeOnDisk
          }
        })
      }
      return formatBytes(totalBytes)
    }
  }

  const handleRemoveClick = (itemType: 'movies' | 'series', itemIndex: number) => {
    setRemovalState({
      itemType,
      itemIndex,
      confirming: true
    })
  }

  const handleCancelRemove = () => {
    setRemovalState(null)
  }

  const handleConfirmRemove = async () => {
    if (!removalState || !user._id) return

    setRemoving(true)
    try {
      const updatedSettings = await removePoolItem(
        user._id,
        removalState.itemType,
        removalState.itemIndex
      )
      
      onSettingsUpdate(updatedSettings)
    } catch (error) {
      console.error("Failed to remove item:", error)
    } finally {
      setRemoving(false)
      setRemovalState(null)
    }
  }

  const isItemBeingRemoved = (itemType: 'movies' | 'series', itemIndex: number) => {
    return removalState?.itemType === itemType && 
           removalState?.itemIndex === itemIndex
  }

  const handleDeleteUser = async () => {
    if (!user._id) return

    setDeleting(true)
    try {
      const updatedSettings = await deleteUser(user._id)
      onSettingsUpdate(updatedSettings)
    } catch (error) {
      console.error("Failed to delete user:", error)
    } finally {
      setDeleting(false)
    }
  }

  const handleAdminToggle = async (value: boolean) => {
    if (!user._id) return

    try {
      const updatedSettings = await updateUserStatus(user._id, value, undefined)
      onSettingsUpdate(updatedSettings)
    } catch (error) {
      console.error("Failed to update admin status:", error)
    }
  }

  const handleSuperUserToggle = async (value: boolean) => {
    if (!user._id) return

    try {
      const updatedSettings = await updateUserStatus(user._id, undefined, value)
      onSettingsUpdate(updatedSettings)
    } catch (error) {
      console.error("Failed to update super user status:", error)
    }
  }

  const handleMoviesOverwriteChange = async (value: string | null) => {
    if (!user._id) return

    try {
      const numericValue = userOverwriteToNumber(value)
      const updatedSettings = await updateUserOverwrites(user._id, numericValue, undefined)
      onSettingsUpdate(updatedSettings)
    } catch (error) {
      console.error("Failed to update movies overwrite:", error)
    }
  }

  const handleSeriesOverwriteChange = async (value: string | null) => {
    if (!user._id) return

    try {
      const numericValue = userOverwriteToNumber(value)
      const updatedSettings = await updateUserOverwrites(user._id, undefined, numericValue)
      onSettingsUpdate(updatedSettings)
    } catch (error) {
      console.error("Failed to update series overwrite:", error)
    }
  }

  const currentItems = contentType === 'movies' ? user.pool.movies : user.pool.series

  return (
    <div className="user-card">
      <div className="user-card-header">
        <div className="user-card-header-content">
          <h3 className="user-name">{user.name}</h3>
          <div className="user-card-header-actions">
            {isOwner ? (
              <Chip label="Owner" color="primary" size="small" />
            ) : user.admin ? (
              <Chip label="Admin" color="error" size="small" />
            ) : user.super_user ? (
              <Chip label="Super" color="warning" size="small" />
            ) : null}
            <IconButton
              size="small"
              onClick={() => {
                if (settingsMode === 'normal') {
                  setSettingsMode('settings')
                } else {
                  setSettingsMode('normal')
                }
              }}
              sx={{ ml: 0.5, color: 'rgba(255, 255, 255, 0.7)' }}
            >
              <Settings/>
            </IconButton>
          </div>
        </div>
      </div>
      
      <CardContent className="user-card-content">
        {settingsMode === 'normal' && (
          <>
            <div className="user-card-toggle">
              <Button
                className={`toggle-button ${contentType === 'movies' ? 'active' : 'inactive'}`}
                onClick={() => setContentType('movies')}
                startIcon={<MovieRounded />}
              >
                Movies ({user.pool.movies.length}/{calculateUserMovieLimit(user, settings)})
              </Button>
              <Button
                className={`toggle-button ${contentType === 'series' ? 'active' : 'inactive'}`}
                onClick={() => setContentType('series')}
                startIcon={<TvRounded />}
              >
                Series ({user.pool.series.length}/{calculateUserSeriesLimit(user, settings)})
              </Button>
            </div>

            <div className="user-card-scroll-container">
              {currentItems.length === 0 ? (
                <Typography variant="body2" className="empty-state">
                  No {contentType} yet
                </Typography>
              ) : (
                currentItems.map((item, index) => (
                  <div 
                    key={index} 
                    className="user-card-item"
                    onMouseEnter={() => setHoveredItem(index)}
                    onMouseLeave={() => setHoveredItem(null)}
                  >
                    <Typography variant="body2" className="item-title">
                      <span className={`title-text ${hoveredItem === index ? 'fade-out' : 'fade-in'}`}>
                        {item.title} ({item.year})
                      </span>
                      <span className={`storage-text ${hoveredItem === index ? 'fade-in' : 'fade-out'}`}>
                        {getItemStorage(item, contentType)}
                      </span>
                    </Typography>
                    
                    <div className="item-actions">
                      <Collapse in={isItemBeingRemoved(contentType, index)} orientation="horizontal">
                        <div className="action-buttons">
                          <Button
                            size="small"
                            variant="contained"
                            color="error"
                            onClick={handleConfirmRemove}
                            disabled={removing}
                            startIcon={<CheckCircle />}
                            className="confirm-button"
                          >
                            Yes
                          </Button>
                          <Button
                            size="small"
                            variant="outlined"
                            onClick={handleCancelRemove}
                            disabled={removing}
                            className="confirm-button"
                          >
                            No
                          </Button>
                        </div>
                      </Collapse>
                      
                      <Collapse in={!isItemBeingRemoved(contentType, index)} orientation="horizontal">
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => handleRemoveClick(contentType, index)}
                          className="delete-button"
                        >
                          <Clear/>
                        </IconButton>
                      </Collapse>
                    </div>
                  </div>
                ))
              )}
            </div>
          </>
        )}

        {settingsMode === 'settings' && (
          <div className="user-settings-container">
            <div className="user-settings-toggles">
              <Toggle
                name="Admin Status"
                checked={user.admin}
                onToggle={handleAdminToggle}
              />
              <Toggle
                name="Super User Status"
                checked={user.super_user}
                onToggle={handleSuperUserToggle}
              />
            </div>

            <div className="user-settings-autocompletes">
              <MUIAutocomplete
                label="Max Movies Overwrite"
                placeholder="No Overwrite"
                options={userOverwriteSelection()}
                value={user.max_movies_overwrite === null ? null : numberToUserOverwriteString(user.max_movies_overwrite)}
                setValue={handleMoviesOverwriteChange}
              />
              <MUIAutocomplete
                label="Max Series Overwrite"
                placeholder="No Overwrite" 
                options={userOverwriteSelection()}
                value={user.max_series_overwrite === null ? null : numberToUserOverwriteString(user.max_series_overwrite)}
                setValue={handleSeriesOverwriteChange}
              />
            </div>
            
            <div style={{ flexGrow: 1 }} />
            
            <Button
              variant="contained"
              color="error"
              onClick={() => setSettingsMode('confirm')}
              sx={{
                width: '100%',
                flexShrink: 0,
                py: 1,
                height: '40px',
                backgroundColor: '#d32f2f',
                '&:hover': {
                  backgroundColor: '#b71c1c'
                }
              }}
            >
              Delete User
            </Button>
          </div>
        )}

        {settingsMode === 'confirm' && (
          <div className="user-confirm-container">
            <Typography variant="body2" sx={{ mb: 3, color: 'rgba(255, 255, 255, 0.8)', textAlign: 'center' }}>
              This action is irreversible. All of {user.name}'s pool items and settings will be permanently deleted.
              <br /><br />
              Are you sure you want to delete this user?
            </Typography>
            
            <div style={{ flexGrow: 1 }} />
            
            <div style={{ display: 'flex', gap: '12px' }}>
              <Button
                variant="outlined"
                onClick={() => setSettingsMode('settings')}
                sx={{
                  flex: 1,
                  flexShrink: 0,
                  py: 1,
                  height: '40px',
                  color: 'rgba(255, 255, 255, 0.7)',
                  borderColor: 'rgba(255, 255, 255, 0.3)',
                  '&:hover': {
                    borderColor: 'rgba(255, 255, 255, 0.5)'
                  }
                }}
              >
                Back
              </Button>
              <Button
                variant="contained"
                color="error"
                onClick={handleDeleteUser}
                disabled={deleting}
                sx={{
                  flex: 1,
                  flexShrink: 0,
                  py: 1,
                  height: '40px',
                  backgroundColor: '#d32f2f',
                  '&:hover': {
                    backgroundColor: '#b71c1c'
                  }
                }}
              >
                Delete User
              </Button>
            </div>
          </div>
        )}
      </CardContent>
      
      {settingsMode === 'normal' && (
        <div className="user-card-footer">
          <span>Total Storage Used: {calculateUserTotalStorage(user)}</span>
        </div>
      )}
    </div>
  )
}

export default UserCard