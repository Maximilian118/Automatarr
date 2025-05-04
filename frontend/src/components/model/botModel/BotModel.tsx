import React, { Dispatch, ReactNode, SetStateAction } from "react"
import { statusColours } from "../modelUtility"
import { Switch } from "@mui/material"
import { settingsType } from "../../../types/settingsType"

interface BotModelType {
  children: ReactNode
  title: string
  settings: settingsType
  setSettings: Dispatch<SetStateAction<settingsType>>
  activeSwitchTarget: keyof settingsType
  startIcon?: ReactNode
  status?: "Connected" | "Disconnected"
}

const BotModel: React.FC<BotModelType> = ({ 
  children, 
  title, 
  settings, 
  setSettings, 
  activeSwitchTarget,
  startIcon, 
  status 
  }) => {
  const handleSwitchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSettings(prevSettings => {
      return {
        ...prevSettings,
        [activeSwitchTarget]: event.target.checked,
      }
    })
  }

  return (
    <div className="model">
      <div className="model-top">
        <div className="model-top-left">
          {typeof startIcon === "string" ? <img alt="API Symbol" src={startIcon} /> : startIcon}
          {title && <h2>{title}</h2>}
        </div>
        <Switch
          checked={settings[activeSwitchTarget] as boolean}
          onChange={handleSwitchChange}
          inputProps={{ 'aria-label': 'controlled' }}
        />
      </div>
      {status && <p style={{ color: statusColours(status) }}>{status}</p>}
      {children}
    </div>
  )
}

export default BotModel
