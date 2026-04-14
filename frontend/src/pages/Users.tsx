import React, { useState, useEffect, useContext } from "react"
import { Alert, CircularProgress } from "@mui/material"
import { getSettings } from "../shared/requests/settingsRequests"
import { settingsType } from "../types/settingsType"
import UserCards from "../components/UserCards/UserCards"
import StorageChart from "../components/utility/StorageChart/StorageChart"
import AppContext from "../context"
import Footer from "../components/footer/Footer"

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
    <main>
      <StorageChart users={users}/>
      <UserCards
        users={users}
        settings={settings}
        onSettingsUpdate={handleSettingsUpdate}
      />
      <Footer/>
    </main>
  )
}

export default Users