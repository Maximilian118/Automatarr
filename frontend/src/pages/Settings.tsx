import { Button, CircularProgress } from "@mui/material"
import React, { FormEvent, useContext, useEffect, useState } from "react"
import AppContext from "../context"
import { Loop as MuiLoop, Send } from "@mui/icons-material"
import { initSettingsErrors } from "../shared/init"
import { updateInput } from "../shared/formValidation"
import { settingsErrorType, settingsType } from "../types/settingsType"
import { getSettings, updateSettings } from "../shared/requests/settingsRequests"
import InputModel from "../components/model/inputModel/InputModel"
import Loop from "../components/loop/Loop"
import LoopTime from "../components/loop/looptime/Looptime"
import MUITextField from "../components/utility/MUITextField/MUITextField"

const Settings: React.FC = () => {
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
    type?: string
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
    />
  )

  const loop = (
    name: keyof settingsType, 
    desc?: string,
    params?: JSX.Element,
    disabled?: boolean,
    disabledText?: string
  ) => (
    <Loop
      title={name.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
      loop={name}
      settings={settings}
      setSettings={setSettings}
      desc={desc}
      disabled={disabled}
      disabledText={disabledText}
      params={(
        <>
          <LoopTime
            loop={`${name}_loop` as keyof settingsType}
            settings={settings}
            setSettings={setSettings}
            disabled={disabled}
          />
          {params}
        </>
      )}
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
      <InputModel 
        title="Loops" 
        startIcon={<MuiLoop/>}
      >
        {loop(
          "import_blocked",
          "Import all downloads that have a status of 'importBlocked' or 'importFailed' in Starr App queues. If a download has 'missing' files or is 'unsupported' in any way, delete it.",
        )}
        {loop(
          "wanted_missing",
          "Start a search for all missing content in the Wanted > Missing tabs.",
        )}
        {loop(
          "remove_failed",
          "Remove all downloads in qBittorrent download paths that have failed.",
          undefined,
          !settings.qBittorrent_active,
          "qBittorrent Required"
        )}
        {loop(
          "remove_missing",
          "Remove any content in the file system that doesn't appear in Starr app libraries. Particularly useful when using dynamic import lists.",
        )}
        {loop(
          "permissions_change",
          "Change the ownership and permissions of the entire contents of Starr app root folders to the specified user and group.",
          <>
            {settingsTextField("permissions_change_chown", "User : Group", "small")}
            {settingsTextField("permissions_change_chmod", "Permissions", "small", 3)}
          </>
        )}
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
