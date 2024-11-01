import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { ThemeProvider, createTheme } from '@mui/material/styles'
import App from './App.tsx'
import axios from 'axios'

const protocol = window.location.protocol // http: or https:
const backend_IP = import.meta.env.VITE_BACKEND_IP ? import.meta.env.VITE_BACKEND_IP : "localhost" // Allow env variable overwrite
const backend_PORT = import.meta.env.VITE_BACKEND_PORT ? import.meta.env.VITE_BACKEND_PORT : "8091" // Target backend port if changed

// URL for all GraphQL requests.
axios.defaults.baseURL = `${protocol}//${backend_IP}:${backend_PORT}/graphql`

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
