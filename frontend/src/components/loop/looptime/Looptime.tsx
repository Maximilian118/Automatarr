import { Autocomplete, TextField } from "@mui/material"
import React, { Dispatch, SetStateAction, useEffect, useState } from "react"
import './_loopTime.scss'
import { settingsErrorType, settingsType } from "../../../types/settingsType"

interface LoopTimeType {
  loop: keyof settingsType
  settings: settingsType
  setSettings: Dispatch<SetStateAction<settingsType>>
  formErr: settingsErrorType
  setFormErr: Dispatch<SetStateAction<settingsErrorType>>
  disabled?: boolean
}

type UnitsType = "minutes" | "hours" | "days" | "weeks"

type IntType = { 
  interval: number
  unit: UnitsType
}

const minutesToInterval = (loopMins: number): IntType => {
  const units = ["minutes", "hours", "days", "weeks"]
  const factors = [1, 60, 1440, 10080]

  for (let i = factors.length - 1; i >= 0; i--) {
    if (loopMins >= factors[i]) {
      const interval = loopMins / factors[i]
      if (interval <= 60) {
        return { interval: Math.round(interval), unit: units[i] as UnitsType}
      }
    }
  }
  return { interval: loopMins, unit: "minutes" } // Default to minutes if nothing matches
}

const intervalToMinutes = (interval: number, unit: "minutes" | "hours" | "days" | "weeks") => {
  const unitToMinutes = {
    minutes: 1,
    hours: 60,
    days: 1440,
    weeks: 10080,
  }

  return interval * unitToMinutes[unit]
}

const mins = () => {
  const nums = []

  for (let n = 1; n <= 60; n++) {
    nums.push(String(n))
  }

  return nums
}

const LoopTime: React.FC<LoopTimeType> = ({
  loop,
  settings,
  setSettings,
  formErr,
  setFormErr,
  disabled,
}) => {
  const [ int, setInt ] = useState(minutesToInterval(settings[loop] as number))

  useEffect(() => {
    const mins = intervalToMinutes(int.interval, int.unit)

    if (Number.isNaN(mins)) {
      setFormErr(prevErrs => {
        return {
          ...prevErrs,
          [loop]: "Loop value is not a number.",
        }
      })
    }

    setSettings(prevSettings => {
      return {
        ...prevSettings,
        [loop]: mins,
      }
    })
  }, [int, loop, setSettings, setFormErr])

  return (
    <div className="loop-time">
      <Autocomplete
        value={String(int.interval)}
        onChange={(_, interval: string | null) => {
          setFormErr(prevErrs => {
            return {
              ...prevErrs,
              [loop]: "",
            }
          })
          
          setInt(prevInt => {
            return {
              ...prevInt,
              interval: Number(interval),
            }
          })
        }}
        disablePortal
        options={mins()}
        sx={{ width: "110px" }}
        renderInput={(params) => <TextField {...params} label="Interval" error={!!formErr[loop]}/>}
        size="small"
        disabled={disabled}
      />
      <Autocomplete
        value={int.unit}
        onChange={(_, unit: string | null) => {
          setFormErr(prevErrs => {
            return {
              ...prevErrs,
              [loop]: "",
            }
          })
          
          setInt(prevInt => {
            return {
              ...prevInt,
              unit: unit as UnitsType,
            }
          })
        }}
        disablePortal
        options={["minutes", "hours", "days", "weeks"]}
        sx={{ width: "145px"}}
        renderInput={(params) => <TextField {...params} label="Unit" error={!!formErr[loop]}/>}
        size="small"
        disabled={disabled}
      />
    </div>
  )
}

export default LoopTime
