import React from "react"
import { NavLink, useLocation } from "react-router-dom"
import { Ellipsis } from "lucide-react"
import { primaryNavItems, secondaryNavItems } from "../../nav/navUtility"
import "./_bottomBar.scss"

interface BottomBarProps {
  onOpenMore: () => void
  moreOpen: boolean
}

// Phone navigation in thumb reach: the four most used pages plus a "More" sheet for the rest
const BottomBar: React.FC<BottomBarProps> = ({ onOpenMore, moreOpen }) => {
  const location = useLocation()
  const onSecondaryPage = secondaryNavItems.some((item) => item.url === location.pathname)

  return (
    <nav className="bottom-bar" aria-label="Main">
      <ul>
        {primaryNavItems.map(({ text, url, icon: Icon }) => (
          <li key={url}>
            <NavLink to={url} end={url === "/"} className="bottom-bar-link">
              <Icon aria-hidden="true" />
              <span>{text}</span>
            </NavLink>
          </li>
        ))}
        <li>
          <button
            type="button"
            className={`bottom-bar-link${onSecondaryPage ? " is-current" : ""}`}
            onClick={onOpenMore}
            aria-haspopup="dialog"
            aria-expanded={moreOpen}
          >
            <Ellipsis aria-hidden="true" />
            <span>More</span>
          </button>
        </li>
      </ul>
    </nav>
  )
}

export default BottomBar
