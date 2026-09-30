import React from "react"
import { NavLink } from "react-router-dom"
import { LogOut } from "lucide-react"
import logo from "../../../assets/logo.webp"
import { navGroups } from "../../nav/navUtility"
import ThemeToggle from "../ThemeToggle/ThemeToggle"
import "./_navRail.scss"

interface NavRailProps {
  onLogout: () => void
}

// Side navigation for tablet and desktop. Full labels on desktop; icons with short labels on tablet
const NavRail: React.FC<NavRailProps> = ({ onLogout }) => (
  <aside className="nav-rail">
    <NavLink to="/" className="nav-rail-brand" aria-label="Automatarr dashboard">
      <img src={logo} alt="" width={53} height={40} />
      <span className="nav-rail-wordmark">automatarr</span>
    </NavLink>
    <nav aria-label="Main">
      {navGroups.map((group) => (
        <div key={group.label} className="nav-rail-group" role="group" aria-labelledby={`nav-group-${group.label}`}>
          <h2 id={`nav-group-${group.label}`} className="nav-rail-group-label">{group.label}</h2>
          <ul>
            {group.items.map(({ text, url, icon: Icon }) => (
              <li key={url}>
                <NavLink to={url} end={url === "/"} className="nav-rail-link">
                  <Icon aria-hidden="true" />
                  <span>{text}</span>
                </NavLink>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
    <div className="nav-rail-footer">
      <div className="nav-rail-theme-full">
        <ThemeToggle />
      </div>
      <div className="nav-rail-theme-compact">
        <ThemeToggle variant="cycle" />
      </div>
      <button type="button" className="nav-rail-link nav-rail-logout" onClick={onLogout}>
        <LogOut aria-hidden="true" />
        <span>Log out</span>
      </button>
    </div>
  </aside>
)

export default NavRail
