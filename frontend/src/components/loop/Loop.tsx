import React, { Dispatch, SetStateAction } from "react"
import { Switch } from '@mui/material'
import { settingsType } from "../../shared/types"
import './_loop.scss'

interface LoopType {
  title: string
  loop: keyof settingsType
  settings: settingsType
  setSettings: Dispatch<SetStateAction<settingsType>>
  desc?: string
  params?: JSX.Element
}

const Loop: React.FC<LoopType> = ({ title, loop, settings, setSettings, desc, params }) => {
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
        <h4>{title}</h4>
        <Switch
          checked={settings[loop] as boolean}
          onChange={handleSwitchChange}
          inputProps={{ 'aria-label': 'controlled' }}
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
