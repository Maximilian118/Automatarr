import { Button, CircularProgress, TextField } from "@mui/material"
import React, { FormEvent, useContext, useEffect, useState } from "react"
import AppContext from "../context"
import { getSettings, updateSettings } from "../shared/requests/settingsRequests"
import { Send } from "@mui/icons-material"
import { initSettingsErrors, initValidAPI } from "../shared/init"
import { inputLabel, updateInput } from "../shared/formValidation"
import { settingsErrorType, validAPIType } from "../shared/types"
import { checkLidarr, checkRadarr, checkSonarr } from "../shared/requests/checkAPIRequests"

const Settings: React.FC = () => {
  const { settings, setSettings } = useContext(AppContext)
  const [ loading, setLoading ] = useState<boolean>(false)
  const [ formErr, setFormErr ] = useState<settingsErrorType>(initSettingsErrors())
  const [ validAPI, setValidAPI ] = useState<validAPIType>(initValidAPI)

  // Check the status of each API
  const checkAPI = async () => {
    await checkRadarr(setValidAPI)
    await checkSonarr(setValidAPI)
    await checkLidarr(setValidAPI)
  }

  // Get latest settings from db on page load
  useEffect(() => {
    const checkSettings = async () => {
      // initialise the form with the latest settings
      await getSettings(setLoading, setSettings)
      // Check the status of each API
      await checkAPI()
    } 

    checkSettings()
  }, [setSettings])

  // Update settings object in db on submit
  const onSubmitHandler = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    await updateSettings(setLoading, settings, setSettings)
    await checkAPI()
  }

  return (
    <form onSubmit={e => onSubmitHandler(e)}>
      <TextField 
        label={inputLabel("radarr_URL", formErr)}
        name="radarr_URL"
        value={settings.radarr_URL}
        onChange={(e) => updateInput(e, setSettings, setFormErr)}
        color={validAPI.radarr ? "success" : "primary"}
        error={!!formErr.radarr_URL}
      />
      <TextField 
        label={inputLabel("radarr_KEY", formErr)}
        name="radarr_KEY"
        value={settings.radarr_KEY}
        onChange={(e) => updateInput(e, setSettings, setFormErr)}
        color={validAPI.radarr ? "success" : "primary"}
        error={!!formErr.radarr_KEY}
      />
      <TextField 
        label={inputLabel("sonarr_URL", formErr)}
        name="sonarr_URL"
        value={settings.sonarr_URL}
        onChange={(e) => updateInput(e, setSettings, setFormErr)}
        color={validAPI.sonarr ? "success" : "primary"}
        error={!!formErr.sonarr_URL}
      />
      <TextField 
        label={inputLabel("sonarr_KEY", formErr)}
        name="sonarr_KEY"
        value={settings.sonarr_KEY}
        onChange={(e) => updateInput(e, setSettings, setFormErr)}
        color={validAPI.sonarr ? "success" : "primary"}
        error={!!formErr.sonarr_KEY}
      />
      <TextField 
        label={inputLabel("lidarr_URL", formErr)}
        name="lidarr_URL"
        value={settings.lidarr_URL}
        onChange={(e) => updateInput(e, setSettings, setFormErr)}
        color={validAPI.lidarr ? "success" : "primary"}
        error={!!formErr.lidarr_URL}
      />
      <TextField 
        label={inputLabel("lidarr_KEY", formErr)}
        name="lidarr_KEY"
        value={settings.lidarr_KEY}
        onChange={(e) => updateInput(e, setSettings, setFormErr)}
        color={validAPI.lidarr ? "success" : "primary"}
        error={!!formErr.lidarr_KEY}
      />
      <Button 
        type="submit"
        variant="contained"
        endIcon={loading ? 
          <CircularProgress size={20} color="inherit"/> : 
          <Send color="inherit"/>
        }
      >Submit</Button>
    </form>
  )
}

export default Settings
