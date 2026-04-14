import React, { ReactNode } from "react"
import { statusColours } from "../panelUtility"
import { Switch } from "@mui/material"
import { multilineText } from "../../../shared/utility"

interface BotPanelType {
  children: ReactNode
  title: string
  description?: string
  startIcon?: ReactNode
  status?: "Connected" | "Disconnected"
  active: boolean
  onToggle: (value: boolean) => void
}

// A panel container for bot configurations with an active toggle and status indicator
export const BotPanel: React.FC<BotPanelType> = ({
  children,
  title,
  description,
  startIcon,
  status,
  active,
  onToggle,
}) => {
  const handleSwitchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    onToggle(event.target.checked)
  }

  return (
    <div className="panel">
      <div className="panel-top">
        <div className="panel-top-left">
          {typeof startIcon === "string" ? <img alt="API Symbol" src={startIcon} /> : startIcon}
          {title && <h2>{title}</h2>}
        </div>
        <Switch
          checked={active}
          onChange={handleSwitchChange}
          inputProps={{ 'aria-label': 'controlled' }}
        />
      </div>
      {description && multilineText(description, "panel-description")}
      {status && <p style={{ color: statusColours(status) }}>{status}</p>}
      {children}
    </div>
  )
}
