import React, { useState } from 'react'
import AppContext from './context'
import "./scss/base.scss"
import Nav from './components/nav/Nav'
import Router from './Router'
import { initData, initSettings } from './shared/init'
import { settingsType } from './types/settingsType'
import { dataType } from './types/dataType'

const App: React.FC = () => {
  const [ settings, setSettings] = useState<settingsType>(initSettings)
  const [ data, setData ] = useState<dataType>(initData)

  return (  
    <AppContext.Provider value={{ settings, setSettings, data, setData }}>
      <Nav/>
      <Router/>
    </AppContext.Provider>
  )
}

export default App
