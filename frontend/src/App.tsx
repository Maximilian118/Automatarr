import React, { useState } from 'react'
import AppContext from './context'
import "./scss/base.scss"
import Nav from './components/nav/Nav'
import Footer from './components/footer/footer'
import { CircularProgress } from '@mui/material'
import Router from './Router'

const App: React.FC = () => {
  const [ loading, setLoading ] = useState<boolean>(false)

  return (  
    <AppContext.Provider value={{ loading, setLoading }}>
      <Nav/>
      {loading ? <CircularProgress/> : <Router/>}
      <Footer/>
    </AppContext.Provider>
  )
}

export default App
