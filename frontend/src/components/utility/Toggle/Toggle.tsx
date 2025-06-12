import React from "react"
import './Toggle.scss'
import { Switch } from "@mui/material"

interface ToggleType {
  name: string
  checked: boolean
  onToggle: (value: boolean) => void
}

const Toggle: React.FC<ToggleType> = ({ name, checked, onToggle }) => {
  const handleSwitchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
      onToggle(event.target.checked)
    }

  return (
    <div className="toggle">
      <p>{name}</p>
      <Switch
        checked={checked}
        onChange={handleSwitchChange}
        inputProps={{ 'aria-label': 'controlled' }}
      />
    </div>
  )
}

export default Toggle
