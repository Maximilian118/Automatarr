import React, { useState, useEffect, useContext } from "react"
import { Alert, CircularProgress } from "@mui/material"
import { getSettings } from "../shared/requests/settingsRequests"
import { settingsType } from "../types/settingsType"
import UserCard from "../components/userCard/UserCard"
import AppContext from "../context"

const Users: React.FC = () => {
  const { loading, setLoading } = useContext(AppContext)
  const [ localLoading, setLocalLoading ] = useState<boolean>(true)
  const [ settings, setSettings ] = useState<settingsType | null>(null)

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const data = await getSettings()
        setSettings(data)
      } catch (error) {
        console.error("Failed to fetch settings:", error)
      } finally {
        setLocalLoading(false)
      }
    }

    fetchSettings()
  }, [])

  // On localLoading change, change global loading as well
  useEffect(() => {
    if (localLoading !== loading) {
      setLoading(localLoading)
    }
  }, [localLoading, loading, setLoading])

  const handleSettingsUpdate = (newSettings: settingsType) => {
    setSettings(newSettings)
  }

  if (localLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '400px' }}>
        <CircularProgress />
      </div>
    )
  }

  if (!settings) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '400px' }}>
        <Alert severity="error">Failed to load user data</Alert>
      </div>
    )
  }

  const users = settings.general_bot.users

  return (
    <div style={{ padding: '24px' }}>
      {users.length === 0 ? (
        <Alert severity="info">No users found</Alert>
      ) : (
        <div style={{ 
          display: 'flex',
          flexWrap: 'wrap',
          gap: '24px',
          justifyContent: 'center'
        }}>
          {users.map((user, index) => (
            <UserCard
              key={user._id}
              user={user}
              settings={settings}
              onSettingsUpdate={handleSettingsUpdate}
              isOwner={index === 0}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export default Users