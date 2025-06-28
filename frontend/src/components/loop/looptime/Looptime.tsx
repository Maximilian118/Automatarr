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
  maxUnit?: UnitsType
  minUnit?: UnitsType
}

type UnitsType = "minutes" | "hours" | "days" | "weeks" | "months" | "years"

type IntType = { 
  interval: number
  unit: UnitsType
}

const unitFactors: Record<UnitsType, number> = {
  minutes: 1,
  hours: 60,
  days: 1440,
  weeks: 10080,
  months: 43800,    // ~30.42 days
  years: 525600     // ~365 days
}

const orderedUnits: UnitsType[] = [
  "minutes",
  "hours",
  "days",
  "weeks",
  "months",
  "years"
]

const minutesToInterval = (loopMins: number): IntType => {
  for (let i = orderedUnits.length - 1; i >= 0; i--) {
    const unit = orderedUnits[i]
    const factor = unitFactors[unit]
    if (loopMins >= factor) {
      const interval = loopMins / factor
      if (interval <= 60) {
        return { interval: Math.round(interval), unit }
      }
    }
  }
  return { interval: loopMins, unit: "minutes" }
}

const intervalToMinutes = (interval: number, unit: UnitsType): number => {
  return interval * unitFactors[unit]
}

const mins = (): string[] => Array.from({ length: 60 }, (_, i) => String(i + 1))

const LoopTime: React.FC<LoopTimeType> = ({
  loop,
  settings,
  setSettings,
  formErr,
  setFormErr,
  disabled,
  maxUnit,
  minUnit
}) => {
  const [int, setInt] = useState<IntType>(minutesToInterval(settings[loop] as number))

  // Compute allowed unit range
  const minIndex = minUnit ? orderedUnits.indexOf(minUnit) : 0
  const maxIndex = maxUnit ? orderedUnits.indexOf(maxUnit) : orderedUnits.length - 1
  const availableUnits = orderedUnits.slice(minIndex, maxIndex + 1)

  useEffect(() => {
    const mins = intervalToMinutes(int.interval, int.unit)

    if (Number.isNaN(mins)) {
      setFormErr(prevErrs => ({
        ...prevErrs,
        [loop]: "Loop value is not a number.",
      }))
      return
    }

    setSettings(prevSettings => ({
      ...prevSettings,
      [loop]: mins,
    }))
  }, [int, loop, setSettings, setFormErr])

  return (
    <div className="loop-time">
      <Autocomplete
        value={String(int.interval)}
        onChange={(_, interval: string | null) => {
          setFormErr(prevErrs => ({
            ...prevErrs,
            [loop]: "",
          }))

          setInt(prevInt => ({
            ...prevInt,
            interval: Number(interval),
          }))
        }}
        disablePortal
        options={mins()}
        sx={{ width: "110px" }}
        renderInput={(params) => (
          <TextField {...params} label="Interval" error={!!formErr[loop]} />
        )}
        size="small"
        disabled={disabled}
      />
      <Autocomplete
        value={int.unit}
        onChange={(_, unit: string | null) => {
          setFormErr(prevErrs => ({
            ...prevErrs,
            [loop]: "",
          }))

          setInt(prevInt => ({
            ...prevInt,
            unit: unit as UnitsType,
          }))
        }}
        disablePortal
        options={availableUnits}
        sx={{ width: "145px" }}
        renderInput={(params) => (
          <TextField {...params} label="Unit" error={!!formErr[loop]} />
        )}
        size="small"
        disabled={disabled}
      />
    </div>
  )
}

export default LoopTime
