import { Button, CircularProgress } from "@mui/material"
import React, { FormEvent, useContext, useEffect, useState } from "react"
import AppContext from "../context"
import { Send } from "@mui/icons-material"
import { initSettingsErrors } from "../shared/init"
import { updateInput } from "../shared/formValidation"
import { settingsErrorType, settingsType } from "../types/settingsType"
import { getSettings, updateSettings } from "../shared/requests/settingsRequests"
import InputModel from "../components/model/inputModel/InputModel"
import MUITextField from "../components/utility/MUITextField/MUITextField"
import Footer from "../components/footer/Footer"

const Bots: React.FC = () => {
  const { settings, setSettings, loading, setLoading } = useContext(AppContext)
  const [ localLoading, setLocalLoading ] = useState<boolean>(false)
  const [ formErr, setFormErr ] = useState<settingsErrorType>(initSettingsErrors())

  // Get latest settings from db on page load if settings has not been populated
  useEffect(() => {
    if (!settings.updated_at) {
      getSettings(setSettings, setLocalLoading)
    }
  }, [settings, setSettings])

  // Update settings object in db on submit
  const onSubmitHandler = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    await updateSettings(setLocalLoading, settings, setSettings, formErr)
  }

  // On localLoading change, change global loading as well
  useEffect(() => {
    if (localLoading !== loading) {
      setLoading(!loading)
    }
  }, [localLoading, loading, setLoading])

  const settingsTextField = (
    name: keyof settingsType, 
    label?: string, 
    size?: "small" | "medium", 
    maxLength?: number,
    type?: string, 
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

  return (
    <form onSubmit={e => onSubmitHandler(e)}>
      <InputModel 
        title="Discord Bot" 
        startIcon="https://avatars.githubusercontent.com/u/1965106?s=200&v=4"
        status={settings.discord_bot_active ? "Connected" : "Disconnected"}
      >
        {settingsTextField("discord_bot_token", "Token")}
        {settingsTextField("discord_bot_server_id", "Server ID")}
        {settingsTextField("discord_bot_channel_id", "Channel ID")}
      </InputModel>
      <Button 
        type="submit"
        variant="contained"
        sx={{ margin: "20px 0" }}
        endIcon={localLoading ? 
          <CircularProgress size={20} color="inherit"/> : 
          <Send color="inherit"/>
        }
      >Submit</Button>
      <Footer/>
    </form>
  )
}

export default Bots