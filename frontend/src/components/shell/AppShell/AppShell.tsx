import React, { ReactNode, useContext, useState } from "react"
import { useNavigate } from "react-router-dom"
import { LinearProgress } from "@mui/material"
import AppContext from "../../../context"
import { logout } from "../../../shared/localStorage"
import logo from "../../../assets/logo.webp"
import NavRail from "../NavRail/NavRail"
import BottomBar from "../BottomBar/BottomBar"
import MoreSheet from "../MoreSheet/MoreSheet"
import "./_appShell.scss"

interface AppShellProps {
  children: ReactNode
  loading: boolean
}

// Layout for signed-in pages: skip link, navigation for every viewport, and the routed page
const AppShell: React.FC<AppShellProps> = ({ children, loading }) => {
  const { setUser } = useContext(AppContext)
  const navigate = useNavigate()
  const [moreOpen, setMoreOpen] = useState(false)

  // Sign out and return to the login page
  const handleLogout = () => {
    setMoreOpen(false)
    logout(setUser, navigate)
  }

  return (
    <div className="app-shell">
      <a className="skip-link" href="#content">Skip to content</a>
      {loading && <LinearProgress className="app-shell-progress" aria-label="Loading" />}
      <NavRail onLogout={handleLogout} />
      <div className="app-shell-main">
        <header className="app-shell-topbar">
          <img src={logo} alt="" width={32} height={32} />
          <span className="app-shell-wordmark">automatarr</span>
        </header>
        <div className="app-content" id="content" tabIndex={-1}>
          {children}
        </div>
      </div>
      <BottomBar onOpenMore={() => setMoreOpen(true)} moreOpen={moreOpen} />
      <MoreSheet open={moreOpen} onClose={() => setMoreOpen(false)} onLogout={handleLogout} />
    </div>
  )
}

export default AppShell
