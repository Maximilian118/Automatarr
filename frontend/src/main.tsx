import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { ThemeProvider, createTheme } from '@mui/material/styles'
import App from './App.tsx'
import axios from 'axios'

const protocol = window.location.protocol; // e.g., http: or https:
const host = window.location.hostname; // e.g., localhost or the IP address

// URL for all graphql requests.
axios.defaults.baseURL = `${protocol}//${host}:8091/graphql`

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
