import { Dispatch, HTMLInputTypeAttribute, SetStateAction } from "react";
import MUITextField from "../components/utility/MUITextField/MUITextField";
import { settingsErrorType, settingsType } from "../types/settingsType";
import { updateInput } from "./formValidation";

export const textField = (
  name: keyof settingsType,
  settings: settingsType,
  setSettings: Dispatch<SetStateAction<settingsType>>,
  formErr: settingsErrorType,
  setFormErr: Dispatch<SetStateAction<settingsErrorType>>,
  label?: string,
  type?: HTMLInputTypeAttribute,
  size?: "small" | "medium", 
  maxLength?: number,
  disabled?: boolean
) => (
  <MUITextField 
    label={label}
    name={name}
    value={settings[name] as string}
    formErr={formErr}
    color={settings[`${name.split('_')[0]}_active` as keyof settingsType] ? "success" : "primary"}
    size={size}
    maxLength={maxLength}
    onBlur={(e) => updateInput(e, setSettings, setFormErr)}
    type={type}
    disabled={disabled}
  />
)