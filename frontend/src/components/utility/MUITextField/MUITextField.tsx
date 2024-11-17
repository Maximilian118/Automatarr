import { TextField } from "@mui/material"
import React, { HTMLInputTypeAttribute, useEffect, useState } from "react"
import { inputLabel } from "../../../shared/formValidation"
import { settingsErrorType, settingsType } from "../../../shared/types"

type MUITextFieldType = {
  name: keyof settingsType
  formErr: settingsErrorType
  value: string
  label?: string
  size?: "small" | "medium"
  maxLength?: number
  onBlur?: (e: React.FocusEvent<HTMLInputElement>) => void
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void
  color?: "error" | "primary" | "secondary" | "info" | "success" | "warning"
  type?: HTMLInputTypeAttribute
}

// Exists for perfomance purposes.
// If the form is heavy and the page is lacking performance on keystrokes, onBlur can be used to apply state to the form when user selects something else.
// onChange is preseved for original UX if the form is light and we can afford to update state per keystroke.
const MUITextField: React.FC<MUITextFieldType> = ({
  name,
  formErr,
  value,
  label,
  size,
  maxLength,
  onBlur,
  onChange,
  color,
  type,
}) => {
  const [ localValue, setLocalValue ] = useState(value)

  const onChangeHandler = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLocalValue(e.target.value)

    if (onChange) {
      onChange(e)
    }
  }

  // Fixes blank inital values on page refresh
  useEffect(() => {
    setLocalValue(value)
  }, [value])

  return (
    <TextField 
      label={inputLabel(name, formErr, label)}
      name={name as unknown as string}
      value={localValue}
      onChange={onChangeHandler}
      onBlur={onBlur}
      color={color}
      error={!!formErr[name]}
      size={size}
      slotProps={maxLength ? { htmlInput: { maxLength: maxLength } } : {}}
      type={type}
    />
  )
}

export default MUITextField
