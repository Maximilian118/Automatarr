import React, { ReactNode } from "react"
import '../_panel.scss'
import { statusColours } from "../panelUtility"
import { multilineText } from "../../../shared/utility"
import { Switch } from "@mui/material"

interface InputPanelType {
  children: ReactNode
  title?: string
  startIcon?: ReactNode
  status?: "Connected" | "Disconnected"
  description?: string
  bottom?: JSX.Element
  checked?: boolean
  onToggle?: (value: boolean) => void
  disabled?: boolean
}

// A panel container for form inputs with a title, icon, optional status indicator, and toggle
const InputPanel: React.FC<InputPanelType> = ({ children, title, startIcon, status, description, bottom, checked, onToggle, disabled }) => {
  const handleSwitchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (onToggle) {
      onToggle(event.target.checked)
    }
  }

  return (
    <div className="panel" style={bottom ? { paddingBottom: 20 } : undefined}>
      <div className="panel-top">
        <div className="panel-top-left">
          {typeof startIcon === "string" ? <img alt="API Symbol" src={startIcon} /> : startIcon}
          {title && <h2>{title}</h2>}
        </div>
        {status && <p style={{ color: statusColours(status) }}>{status}</p>}
        {onToggle && (
          <Switch
            checked={checked}
            onChange={handleSwitchChange}
            inputProps={{ 'aria-label': 'controlled' }}
            disabled={disabled}
          />
        )}
      </div>
      {description && multilineText(description, "panel-description")}
      {children}
      {bottom && (
        <div className="panel-bottom">
          {bottom}
        </div>
      )}
    </div>
  )
}

export default InputPanel
