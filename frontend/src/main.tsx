import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { ThemeProvider, createTheme } from '@mui/material/styles'
import App from './App.tsx'
import axios from 'axios'
import { getAuthCallbacks } from './shared/authCallbacks'
import { logout } from './shared/localStorage'

// URL for backend requests.
const isLocalhost = window.location.hostname === "localhost"
const isDomain = /^[a-zA-Z.-]+$/.test(window.location.hostname) // crude domain check
const isIP = /^\d+\.\d+\.\d+\.\d+$/.test(window.location.hostname)

if (isLocalhost || isDomain) {
  // Development (localhost) or Production with NGINX & domain proxying
  axios.defaults.baseURL = "/graphql"
} else if (isIP) {
  // Access via LAN IP: use the same IP but port 8091
  axios.defaults.baseURL = `http://${window.location.hostname}:8091/graphql`
} else {
  console.warn("Unknown frontend access pattern. Falling back to /graphql.")
  axios.defaults.baseURL = "/graphql"
}

// Redirect to login on any 401 response (expired or invalid tokens).
axios.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      const { setUser, navigate } = getAuthCallbacks()
      if (setUser) {
        logout(setUser, navigate ?? undefined)
      }
    }
    return Promise.reject(error)
  },
)

// MUI style
const theme = createTheme({
  palette: {
    mode: 'dark',
  },
})

createRoot(document.getElementById('root')!).render(
  <BrowserRouter>
    <ThemeProvider theme={theme}>
      <App/>
    </ThemeProvider>
  </BrowserRouter>
)
