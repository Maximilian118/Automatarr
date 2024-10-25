import { Button, CircularProgress, TextField } from "@mui/material"
import React, { FormEvent, useContext, useEffect, useState } from "react"
import AppContext from "../context"
import { Send } from "@mui/icons-material"
import { initSettingsErrors } from "../shared/init"
import { inputLabel, updateInput } from "../shared/formValidation"
import { settingsErrorType } from "../shared/types"
import { getSettings, updateSettings } from "../shared/requests/settingsRequests"
import InputModel from "../components/model/inputModel/inputModel"

const Settings: React.FC = () => {
  const { settings, setSettings } = useContext(AppContext)
  const [ loading, setLoading ] = useState<boolean>(false)
  const [ formErr, setFormErr ] = useState<settingsErrorType>(initSettingsErrors())
  const [ reqSent, setReqSent ] = useState<boolean>(false)

  // Get latest settings from db on page load
  useEffect(() => {
    if (!reqSent) {
      setReqSent(true)
      getSettings(setLoading, setSettings)
    }
  }, [setSettings, reqSent])

  // Update settings object in db on submit
  const onSubmitHandler = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    await updateSettings(setLoading, settings, setSettings)
  }

  return (
    <form onSubmit={e => onSubmitHandler(e)}>
      <InputModel 
        title="Radarr" 
        startIcon="https://radarr.video/img/logo.png"
        status={settings.radarr_active ? "Connected" : "Disconnected"}
      >
        <TextField 
          label={inputLabel("radarr_URL", formErr)}
          name="radarr_URL"
          value={settings.radarr_URL}
          onChange={(e) => updateInput(e, setSettings, setFormErr)}
          color={settings.radarr_active ? "success" : "primary"}
          error={!!formErr.radarr_URL}
        />
        <TextField 
          label={inputLabel("radarr_KEY", formErr)}
          name="radarr_KEY"
          value={settings.radarr_KEY}
          onChange={(e) => updateInput(e, setSettings, setFormErr)}
          color={settings.radarr_active ? "success" : "primary"}
          error={!!formErr.radarr_KEY}
        />
      </InputModel>
      <InputModel 
        title="Sonarr" 
        startIcon="https://sonarr.tv/img/logo.png"
        status={settings.sonarr_active ? "Connected" : "Disconnected"}
      >
        <TextField 
          label={inputLabel("sonarr_URL", formErr)}
          name="sonarr_URL"
          value={settings.sonarr_URL}
          onChange={(e) => updateInput(e, setSettings, setFormErr)}
          color={settings.sonarr_active ? "success" : "primary"}
          error={!!formErr.sonarr_URL}
        />
        <TextField 
          label={inputLabel("sonarr_KEY", formErr)}
          name="sonarr_KEY"
          value={settings.sonarr_KEY}
          onChange={(e) => updateInput(e, setSettings, setFormErr)}
          color={settings.sonarr_active ? "success" : "primary"}
          error={!!formErr.sonarr_KEY}
        />
      </InputModel>
      <InputModel 
        title="Lidarr" 
        startIcon="https://lidarr.audio/img/logo.png"
        status={settings.lidarr_active ? "Connected" : "Disconnected"}
      >
        <TextField 
          label={inputLabel("lidarr_URL", formErr)}
          name="lidarr_URL"
          value={settings.lidarr_URL}
          onChange={(e) => updateInput(e, setSettings, setFormErr)}
          color={settings.lidarr_active ? "success" : "primary"}
          error={!!formErr.lidarr_URL}
        />
        <TextField 
          label={inputLabel("lidarr_KEY", formErr)}
          name="lidarr_KEY"
          value={settings.lidarr_KEY}
          onChange={(e) => updateInput(e, setSettings, setFormErr)}
          color={settings.lidarr_active ? "success" : "primary"}
          error={!!formErr.lidarr_KEY}
        />
      </InputModel>
      <Button 
        type="submit"
        variant="contained"
        sx={{ marginTop: "20px" }}
        endIcon={loading ? 
          <CircularProgress size={20} color="inherit"/> : 
          <Send color="inherit"/>
        }
      >Submit</Button>
    </form>
  )
}

export default Settings
