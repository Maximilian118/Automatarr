import React, { Dispatch, ReactNode, SetStateAction, useId } from "react"
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
  status?: ReactNode
}

// A card for one automation loop: on/off switch, what it does, when it last ran, and its options
const Loop: React.FC<LoopType> = ({
  title,
  loop,
  settings,
  setSettings,
  desc,
  params,
  disabled,
  disabledText,
  status,
}) => {
  const headingId = useId()
  const descId = useId()

  const handleSwitchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSettings(prevSettings => {
      return {
        ...prevSettings,
        [loop]: event.target.checked,
      }
    })
  }

  return (
    <section className={`loop${disabled ? " loop-disabled" : ""}`} aria-labelledby={headingId}>
      <div className="title-and-toggle">
        <div className="loop-title">
          <h3 id={headingId}>{title}</h3>
          {disabled && disabledText && <p className="disabled-text">{disabledText}</p>}
        </div>
        <Switch
          checked={disabled ? false : settings[loop] as boolean}
          onChange={handleSwitchChange}
          inputProps={{ 'aria-label': `Run ${title}`, 'aria-describedby': desc ? descId : undefined }}
          disabled={disabled}
        />
      </div>
      {desc && <p id={descId} className="loop-desc">{desc}</p>}
      {status && <div className="loop-status">{status}</div>}
      {params && (
        <div className="loop-params">
          {params}
        </div>
      )}
    </section>
  )
}

export default Loop
