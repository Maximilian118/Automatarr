import React, { useState, useEffect, useContext } from "react"
import { getSettings } from "../shared/requests/settingsRequests"
import { settingsType } from "../types/settingsType"
import UserCards from "../components/UserCards/UserCards"
import PoolStorage from "../components/PoolStorage/PoolStorage"
import AppContext from "../context"
import Footer from "../components/footer/Footer"
import AIMemories from "../components/AIMemories/AIMemories"
import PageHeader from "../components/ui/PageHeader/PageHeader"
import CenteredLoading from "../components/utility/CenteredLoading/CenteredLoading"

// Everyone who can request content: their pools, limits, storage and what the assistant remembers
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

  const header = (
    <PageHeader
      title="Users"
      description="Everything a person keeps in their pool is protected from cleanup. Drag titles between people, or use the move button on each title."
    />
  )

  if (localLoading) {
    return (
      <main>
        {header}
        <CenteredLoading/>
      </main>
    )
  }

  if (!settings) {
    return (
      <main>
        {header}
        <div className="page-message" role="alert">
          <h2>Users couldn't be loaded</h2>
          <p>Automatarr didn't respond. Check it's running, then reload this page.</p>
        </div>
      </main>
    )
  }

  const users = settings.general_bot.users

  return (
    <main>
      {header}
      <PoolStorage users={users}/>
      <UserCards
        users={users}
        settings={settings}
        onSettingsUpdate={handleSettingsUpdate}
      />
      {/* Privacy matters whenever Plex watch history or the AI is in use, so the panel shows for either */}
      {(settings.ai_bot.active || settings.plex_active) && <AIMemories/>}
      <Footer/>
    </main>
  )
}

export default Users
