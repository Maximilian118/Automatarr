import { Button, CircularProgress } from "@mui/material"
import React, { FormEvent, HTMLInputTypeAttribute, useContext, useEffect, useState } from "react"
import AppContext from "../context"
import { Send } from "@mui/icons-material"
import { initSettingsErrors } from "../shared/init"
import { settingsErrorType, settingsType } from "../types/settingsType"
import { getSettings, updateSettings } from "../shared/requests/settingsRequests"
import InputModel from "../components/model/inputModel/InputModel"
import Footer from "../components/footer/Footer"
import MUITextField from "../components/utility/MUITextField/MUITextField"
import { updateInput } from "../shared/formValidation"
import { useNavigate } from "react-router-dom"

const Connections: React.FC = () => {
  const { user, setUser, settings, setSettings, loading, setLoading } = useContext(AppContext)
  const [ localLoading, setLocalLoading ] = useState<boolean>(false)
  const [ formErr, setFormErr ] = useState<settingsErrorType>(initSettingsErrors())

  const navigate = useNavigate()
  
  // Get latest settings from db on page load if settings has not been populated
  useEffect(() => {
    if (!settings.updated_at) {
      getSettings(setSettings, user, setUser, setLocalLoading, navigate, true)
    }
  }, [user, setUser, settings, setSettings, navigate])

  // Update settings object in db on submit
    const onSubmitHandler = async (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault()
      await updateSettings(setLocalLoading, settings, setSettings, user, setUser, navigate, formErr)
    }

  // On localLoading change, change global loading as well
  useEffect(() => {
    if (localLoading !== loading) {
      setLoading(!loading)
    }
  }, [localLoading, loading, setLoading])

  const MUITextFieldHelper = (name: keyof settingsType, type?: HTMLInputTypeAttribute) => (
    <MUITextField 
      name={name} 
      value={settings[name] as string} 
      formErr={formErr}
      onChange={(e) => updateInput(e, setSettings, setFormErr)}
      color={settings[`${name.split('_')[0]}_active` as keyof settingsType] ? "success" : "primary"}
      type={type}
    />
  )

  return (
    <form onSubmit={e => onSubmitHandler(e)}>
      <InputModel 
        title="Radarr" 
        startIcon="https://radarr.video/img/logo.png"
        status={settings.radarr_active ? "Connected" : "Disconnected"}
      >
        {MUITextFieldHelper("radarr_URL")}
        {MUITextFieldHelper("radarr_KEY")}
      </InputModel>
      <InputModel 
        title="Sonarr" 
        startIcon="https://sonarr.tv/img/logo.png"
        status={settings.sonarr_active ? "Connected" : "Disconnected"}
      >
        {MUITextFieldHelper("sonarr_URL")}
        {MUITextFieldHelper("sonarr_KEY")}
      </InputModel>
      <InputModel 
        title="Lidarr" 
        startIcon="https://lidarr.audio/img/logo.png"
        status={settings.lidarr_active ? "Connected" : "Disconnected"}
      >
        {MUITextFieldHelper("lidarr_URL")}
        {MUITextFieldHelper("lidarr_KEY")}
      </InputModel>
      <InputModel 
        title="qBittorrent" 
        startIcon="https://avatars.githubusercontent.com/u/2131270?s=48&v=4"
        status={settings.qBittorrent_active ? "Connected" : "Disconnected"}
      >
        {MUITextFieldHelper("qBittorrent_URL")}
        {MUITextFieldHelper("qBittorrent_username")}
        {MUITextFieldHelper("qBittorrent_password", "password")}
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

export default Connections
