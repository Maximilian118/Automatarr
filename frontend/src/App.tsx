import React, { useState } from 'react'
import AppContext from './context'
import "./scss/base.scss"
import Nav from './components/nav/Nav'
import Footer from './components/footer/Footer'
import Router from './Router'
import { settingsType } from './shared/types'
import { initSettings } from './shared/init'

const App: React.FC = () => {
  const [ settings, setSettings ] = useState<settingsType>(initSettings)

  return (  
    <AppContext.Provider value={{ settings, setSettings }}>
      <Nav/>
      <Router/>
      <Footer/>
    </AppContext.Provider>
  )
}

export default App
