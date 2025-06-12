import React, { useState } from 'react'
import AppContext from './context'
import "./scss/base.scss"
import Nav from './components/nav/Nav'
import Router from './Router'
import { initData, initSettings } from './shared/init'
import { settingsType } from './types/settingsType'
import { dataType } from './types/dataType'
import { UserType } from './types/userType'
import { checkUserLS } from './shared/localStorage'

const App: React.FC = () => {
  const [ user, setUser ] = useState<UserType>(checkUserLS())
  const [ settings, setSettings] = useState<settingsType>(initSettings)
  const [ data, setData ] = useState<dataType>(initData)
  const [ loading, setLoading ] = useState<boolean>(false)

  return (  
    <AppContext.Provider value={{ user, setUser, settings, setSettings, data, setData, loading, setLoading }}>
      {user.token && <Nav loading={loading}/>}
      <Router user={user}/>
    </AppContext.Provider>
  )
}

export default App
