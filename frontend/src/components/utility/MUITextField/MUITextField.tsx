import { TextField } from "@mui/material"
import React, { HTMLInputTypeAttribute, useEffect, useState } from "react"
import { inputLabel } from "../../../shared/formValidation"

type MUITextFieldProps<T extends Record<string, unknown>> = {
  name: keyof T
  formErr: Record<keyof T, string | undefined>
  value: string
  label?: string
  size?: "small" | "medium"
  maxLength?: number
  onBlur?: (e: React.FocusEvent<HTMLInputElement>) => void
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void
  color?: "error" | "primary" | "secondary" | "info" | "success" | "warning"
  type?: HTMLInputTypeAttribute
  disabled?: boolean
  error?: boolean
  multiline?: number
}

const MUITextField = <T extends Record<string, unknown>>({
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
  disabled,
  error,
  multiline,
}: MUITextFieldProps<T>) => {
  const [localValue, setLocalValue] = useState(value)

  const onChangeHandler = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLocalValue(e.target.value)

    if (onChange) {
      onChange(e)
    }
  }

  useEffect(() => {
    setLocalValue(value)
  }, [value])

  return (
    <TextField 
      label={inputLabel(name, formErr, label)}
      name={name as unknown as string}
      value={localValue || ""}
      onChange={onChangeHandler}
      onBlur={onBlur}
      color={color}
      error={error ?? !!formErr[name]}
      size={size}
      multiline={!!multiline}
      rows={multiline}
      slotProps={maxLength ? { htmlInput: { maxLength } } : {}}
      disabled={disabled}
      type={type}
    />
  )
}

export default MUITextField
