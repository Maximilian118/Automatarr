import React, { Dispatch, SetStateAction } from "react"
import { Switch } from '@mui/material'
import './_loop.scss'
import { settingsType } from "../../types/settingsType"

interface LoopType {
  title: string
  loop: keyof settingsType
  settings: settingsType
  setSettings: Dispatch<SetStateAction<settingsType>>
  desc?: string
  params?: JSX.Element
  disabled?: boolean
  disabledText?: string
}

const Loop: React.FC<LoopType> = ({ 
  title, 
  loop, 
  settings, 
  setSettings, 
  desc, 
  params,
  disabled,
  disabledText,
}) => {
  const handleSwitchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSettings(prevSettings => {
      return {
        ...prevSettings,
        [loop]: event.target.checked,
      }
    })
  }

  return (
    <div className="loop">
      <div className="title-and-toggle">
        <div className="loop-title">
          <h4>{title}</h4>
          {disabled && disabledText && <h4 className="disabled-text">{`- ${disabledText}`}</h4>}
        </div>
          <Switch
            checked={disabled ? false : settings[loop] as boolean}
            onChange={handleSwitchChange}
            inputProps={{ 'aria-label': 'controlled' }}
            disabled={disabled}
          />
      </div>
      {desc && <p>{desc}</p>}
      {params && (
        <div className="loop-params">
          {params}
        </div>
      )}
    </div>
  )
}

export default Loop
