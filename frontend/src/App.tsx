import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import AppContext from './context'
import "./scss/base.scss"
import Router from './Router'
import AppShell from './components/shell/AppShell/AppShell'
import ToastProvider from './components/toast/ToastProvider/ToastProvider'
import { initData, initSettings } from './shared/init'
import { settingsType } from './types/settingsType'
import { dataType } from './types/dataType'
import { UserType } from './types/userType'
import { checkUserLS } from './shared/localStorage'
import { registerAuthCallbacks } from './shared/authCallbacks'
import { headers } from './shared/requests/requestUtility'

const App: React.FC = () => {
  const navigate = useNavigate()
  const [ user, setUser ] = useState<UserType>(checkUserLS())
  const [ settings, setSettings] = useState<settingsType>(initSettings)
  const [ data, setData ] = useState<dataType>(initData)
  const [ loading, setLoading ] = useState<boolean>(false)

  // Register auth callbacks for the axios 401 interceptor and validate stored tokens.
  useEffect(() => {
    registerAuthCallbacks(setUser, navigate)

    // Validate stored tokens against the backend on app load.
    // If expired, the axios 401 interceptor will trigger logout automatically.
    if (user.token) {
      axios.post("", {
        query: `query { getSettings { _id } }`,
      }, {
        headers: headers(user.token),
      }).catch(() => {
        // 401 is handled by the interceptor; other errors are non-fatal on startup.
      })
    }
    // Runs once on load only
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <AppContext.Provider value={{ user, setUser, settings, setSettings, data, setData, loading, setLoading }}>
      <ToastProvider>
        {user.token ? (
          <AppShell loading={loading}>
            <Router user={user}/>
          </AppShell>
        ) : (
          <div className="auth-layout">
            <Router user={user}/>
          </div>
        )}
      </ToastProvider>
    </AppContext.Provider>
  )
}

export default App
