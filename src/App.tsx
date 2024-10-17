import React, { useState } from 'react'
import AppContext from './context'
import "./scss/base.scss"
import Nav from './components/nav/Nav'
import Main from './components/main/main'
import Footer from './components/footer/footer'
import { CircularProgress } from '@mui/material'

const App: React.FC = () => {
  const [ loading, setLoading ] = useState<boolean>(false)

  return (  
    <AppContext.Provider value={{ loading, setLoading }}>
      <Nav/>
      {loading ? <CircularProgress/> : <Main/>}
      <Footer/>
    </AppContext.Provider>
  )
}

export default App
