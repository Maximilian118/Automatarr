import React, { ReactNode, useId } from "react"
import { Switch } from "@mui/material"
import { multilineText } from "../../../shared/utility"
import StatusBadge from "../StatusBadge/StatusBadge"
import "../_panel.scss"

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
  const headingId = useId()

  const handleSwitchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    onToggle(event.target.checked)
  }

  return (
    <section className="panel" aria-labelledby={headingId}>
      <div className="panel-top">
        <div className="panel-top-left">
          {typeof startIcon === "string" ? <img alt="" src={startIcon} /> : startIcon}
          {title && <h2 id={headingId}>{title}</h2>}
        </div>
        <div className="panel-top-right">
          {status && <StatusBadge status={status} />}
          <Switch
            checked={active}
            onChange={handleSwitchChange}
            inputProps={{ 'aria-label': `Enable ${title}` }}
          />
        </div>
      </div>
      {description && multilineText(description, "panel-description")}
      {children}
    </section>
  )
}
