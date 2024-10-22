import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { ThemeProvider, createTheme } from '@mui/material/styles'
import App from './App.tsx'
import axios from 'axios'

// Base URL of backend
axios.defaults.baseURL = "http://localhost:8091/graphql"

// MUI style
const theme = createTheme({
  palette: {
    mode: 'dark',
  },
})

createRoot(document.getElementById('root')!).render(
  <BrowserRouter>
    <StrictMode>
      <ThemeProvider theme={theme}>
        <App/>
      </ThemeProvider>
    </StrictMode>
  </BrowserRouter>
)
