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

const Connections: React.FC = () => {
  const { settings, setSettings } = useContext(AppContext)
  const [ loading, setLoading ] = useState<boolean>(false)
  const [ formErr, setFormErr ] = useState<settingsErrorType>(initSettingsErrors())

  // Get latest settings from db on page load if settings has not been populated
  useEffect(() => {
    if (!settings.updated_at) {
      getSettings(setSettings, setLoading)
    }
  }, [settings, setSettings])

  // Update settings object in db on submit
  const onSubmitHandler = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    await updateSettings(setLoading, settings, setSettings, formErr)
  }

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
        title="Radarr" 
        startIcon="https://radarr.video/img/logo.png"
        status={settings.radarr_active ? "Connected" : "Disconnected"}
      >
        {settingsTextField("radarr_URL")}
        {settingsTextField("radarr_KEY")}
      </InputModel>
      <InputModel 
        title="Sonarr" 
        startIcon="https://sonarr.tv/img/logo.png"
        status={settings.sonarr_active ? "Connected" : "Disconnected"}
      >
        {settingsTextField("sonarr_URL")}
        {settingsTextField("sonarr_KEY")}
      </InputModel>
      <InputModel 
        title="Lidarr" 
        startIcon="https://lidarr.audio/img/logo.png"
        status={settings.lidarr_active ? "Connected" : "Disconnected"}
      >
        {settingsTextField("lidarr_URL")}
        {settingsTextField("lidarr_KEY")}
      </InputModel>
      <InputModel 
        title="qBittorrent" 
        startIcon="https://avatars.githubusercontent.com/u/2131270?s=48&v=4"
        status={settings.qBittorrent_active ? "Connected" : "Disconnected"}
      >
        {settingsTextField("qBittorrent_URL")}
        {settingsTextField("qBittorrent_username")}
        {settingsTextField("qBittorrent_password", undefined, undefined, undefined, "password")}
      </InputModel>
      <Button 
        type="submit"
        variant="contained"
        sx={{ margin: "20px 0" }}
        endIcon={loading ? 
          <CircularProgress size={20} color="inherit"/> : 
          <Send color="inherit"/>
        }
      >Submit</Button>
      <Footer/>
    </form>
  )
}

export default Connections
