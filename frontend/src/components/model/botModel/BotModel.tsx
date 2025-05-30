import React, { ReactNode } from "react"
import { statusColours } from "../modelUtility"
import { Switch } from "@mui/material"
import { multilineText } from "../../../shared/utility"

interface BotModelType {
  children: ReactNode
  title: string
  description?: string
  startIcon?: ReactNode
  status?: "Connected" | "Disconnected"
  active: boolean
  onToggle: (value: boolean) => void
}

export const BotModel: React.FC<BotModelType> = ({ 
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
    <div className="model">
      <div className="model-top">
        <div className="model-top-left">
          {typeof startIcon === "string" ? <img alt="API Symbol" src={startIcon} /> : startIcon}
          {title && <h2>{title}</h2>}
        </div>
        <Switch
          checked={active}
          onChange={handleSwitchChange}
          inputProps={{ 'aria-label': 'controlled' }}
        />
      </div>
      {description && multilineText(description, "model-description")}
      {status && <p style={{ color: statusColours(status) }}>{status}</p>}
      {children}
    </div>
  )
}
