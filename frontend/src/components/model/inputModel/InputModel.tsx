import React, { ReactNode } from "react"
import '../model.scss'
import { statusColours } from "../modelUtility"
import { multilineText } from "../../../shared/utility"
import { Switch } from "@mui/material"

interface InputModelType {
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

const InputModel: React.FC<InputModelType> = ({ children, title, startIcon, status, description, bottom, checked, onToggle, disabled }) => {
  const handleSwitchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (onToggle) {
      onToggle(event.target.checked)
    }
  }

  return (
    <div className="model" style={bottom && { paddingBottom: 20 }}>
      <div className="model-top">
        <div className="model-top-left">
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
      {description && multilineText(description, "model-description")}
      {children}
      {bottom && (
        <div className="model-bottom">
          {bottom}
        </div>
      )}
    </div>
  )
}

export default InputModel
