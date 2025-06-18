import { TextField } from "@mui/material"
import React, { HTMLInputTypeAttribute, useEffect, useState } from "react"
import { inputLabel } from "../../../shared/formValidation"

type MUITextFieldProps<T extends Record<string, unknown>> = {
  name: keyof T
  formErr: Record<keyof T, string | undefined>
  value: string | number
  label?: string
  size?: "small" | "medium"
  minLength?: number
  maxLength?: number
  onBlur?: (e: React.FocusEvent<HTMLInputElement>) => void
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void
  color?: "error" | "primary" | "secondary" | "info" | "success" | "warning"
  type?: HTMLInputTypeAttribute
  disabled?: boolean
  error?: boolean
  multiline?: number
  onlyNumbers?: boolean
  readonly?: boolean
}

const MUITextField = <T extends Record<string, unknown>>({
  name,
  formErr,
  value,
  label,
  size,
  minLength,
  maxLength,
  onBlur,
  onChange,
  color,
  type,
  disabled,
  error,
  multiline,
  onlyNumbers,
  readonly,
}: MUITextFieldProps<T>) => {
  const displayValue = value === Infinity ? "" : String(value)
  const [localValue, setLocalValue] = useState(displayValue)

  useEffect(() => {
    setLocalValue(value === Infinity ? "" : String(value))
  }, [value])

  const onChangeHandler = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value

    if (onlyNumbers) {
      // Allow empty field = Infinity
      if (raw === "") {
        setLocalValue("")
        onChange?.({
          ...e,
          target: { ...e.target, value: "Infinity" },
        })
        return
      }

      const parsed = Number(raw)

      if (!isNaN(parsed) && isFinite(parsed)) {
        setLocalValue(raw)
        onChange?.({
          ...e,
          target: { ...e.target, value: String(parsed) },
        })
        return
      }

      // Invalid input: don't propagate or update local value
      return
    }

    // Normal string input
    setLocalValue(raw)
    onChange?.(e)
  }

  return (
    <TextField
      label={inputLabel(name, formErr, label)}
      name={name as unknown as string}
      value={localValue}
      onChange={onChangeHandler}
      onBlur={onBlur}
      color={color}
      error={error ?? !!formErr[name]}
      size={size}
      multiline={!!multiline}
      rows={multiline}
      type={type || (onlyNumbers ? "text" : undefined)}
      slotProps={{
        htmlInput: {
          minLength,
          maxLength,
          inputMode: onlyNumbers ? "numeric" : undefined,
          pattern: onlyNumbers ? "\\d*" : undefined,
        },
        input: {
          readOnly: readonly
        }
      }}
      disabled={disabled}
    />
  )
}

export default MUITextField
