import React, { useEffect, useRef } from "react"
import { NavLink } from "react-router-dom"
import { LogOut, X } from "lucide-react"
import { secondaryNavItems } from "../../nav/navUtility"
import ThemeToggle from "../ThemeToggle/ThemeToggle"
import "./_moreSheet.scss"

interface MoreSheetProps {
  open: boolean
  onClose: () => void
  onLogout: () => void
}

// Phone-only sheet holding the destinations that don't fit in the bottom bar.
// Built on the native <dialog> element, which traps focus and closes on Escape
const MoreSheet: React.FC<MoreSheetProps> = ({ open, onClose, onLogout }) => {
  const dialogRef = useRef<HTMLDialogElement>(null)

  // Keep the native dialog in step with the open prop
  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  return (
    <dialog
      ref={dialogRef}
      className="more-sheet"
      aria-labelledby="more-sheet-title"
      onClose={onClose}
      onClick={(e) => {
        // A click on the backdrop lands on the dialog element itself
        if (e.target === dialogRef.current) onClose()
      }}
    >
      <div className="more-sheet-body">
        <div className="more-sheet-header">
          <h2 id="more-sheet-title">More</h2>
          <button type="button" className="more-sheet-close" onClick={onClose}>
            <X aria-hidden="true" />
            <span className="visually-hidden">Close menu</span>
          </button>
        </div>
        <nav aria-label="More pages">
          <ul>
            {secondaryNavItems.map(({ text, url, icon: Icon }) => (
              <li key={url}>
                <NavLink to={url} className="more-sheet-link" onClick={onClose}>
                  <Icon aria-hidden="true" />
                  <span>{text}</span>
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
        <ThemeToggle />
        <button type="button" className="more-sheet-link more-sheet-logout" onClick={onLogout}>
          <LogOut aria-hidden="true" />
          <span>Log out</span>
        </button>
      </div>
    </dialog>
  )
}

export default MoreSheet
