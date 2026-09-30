import React from "react"
import './_toggle.scss'
import { Switch } from "@mui/material"

interface ToggleType {
  name: string
  checked: boolean
  onToggle: (value: boolean) => void
  disabled?: boolean
}

// A labelled switch. The whole row is the label, so tapping the text toggles it too
const Toggle: React.FC<ToggleType> = ({ name, checked, onToggle, disabled }) => {
  const handleSwitchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    onToggle(event.target.checked)
  }

  return (
    <label className={`toggle${disabled ? " toggle-disabled" : ""}`}>
      <span className="toggle-label">{name.replace(/:\s*$/, "")}</span>
      <Switch
        checked={checked}
        onChange={handleSwitchChange}
        disabled={disabled}
      />
    </label>
  )
}

export default Toggle
