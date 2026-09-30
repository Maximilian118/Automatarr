import React, { FormEvent, HTMLInputTypeAttribute, useContext, useEffect, useState } from "react"
import AppContext from "../context"
import { Tv } from "lucide-react"
import { initSettingsErrors } from "../shared/init"
import { settingsErrorType, settingsType } from "../types/settingsType"
import { getSettingsWithState, updateSettings } from "../shared/requests/settingsRequests"
import InputPanel from "../components/panel/inputPanel/InputPanel"
import Footer from "../components/footer/Footer"
import MUITextField from "../components/utility/MUITextField/MUITextField"
import { updateInput } from "../shared/formValidation"
import { useNavigate } from "react-router-dom"
import PageHeader from "../components/ui/PageHeader/PageHeader"
import SaveBar from "../components/ui/SaveBar/SaveBar"
import { useSaveFeedback } from "../shared/hooks/useSaveFeedback"
import { formHasErr } from "../shared/utility"

const Connections: React.FC = () => {
  const { user, setUser, settings, setSettings, loading, setLoading } = useContext(AppContext)
  const [ localLoading, setLocalLoading ] = useState<boolean>(false)
  const [ formErr, setFormErr ] = useState<settingsErrorType>(initSettingsErrors())

  const navigate = useNavigate()
  const saveFeedback = useSaveFeedback(settings.updated_at, localLoading, "Connections")

  // Get latest settings from db on page load if settings has not been populated
  useEffect(() => {
    if (!settings.updated_at) {
      getSettingsWithState(setSettings, user, setUser, setLocalLoading, navigate, true)
    }
  }, [user, setUser, settings, setSettings, navigate])

  // Update settings object in db on submit
  const onSubmitHandler = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    saveFeedback.beginSave(!formHasErr(formErr))
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
      <PageHeader
        title="Connections"
        description="Where Automatarr finds your apps. Each service is checked when you save, and its status updates straight away."
      />
      <div className="grid-layout">
        <InputPanel
          title="Radarr"
          startIcon="https://radarr.video/img/logo.png"
          status={settings.radarr_active ? "Connected" : "Disconnected"}
        >
          {MUITextFieldHelper("radarr_URL")}
          {MUITextFieldHelper("radarr_KEY")}
        </InputPanel>
        <InputPanel
          title="Sonarr"
          startIcon="https://sonarr.tv/img/logo.png"
          status={settings.sonarr_active ? "Connected" : "Disconnected"}
        >
          {MUITextFieldHelper("sonarr_URL")}
          {MUITextFieldHelper("sonarr_KEY")}
        </InputPanel>
        <InputPanel
          title="Lidarr"
          startIcon="https://lidarr.audio/img/logo.png"
          status={settings.lidarr_active ? "Connected" : "Disconnected"}
        >
          {MUITextFieldHelper("lidarr_URL")}
          {MUITextFieldHelper("lidarr_KEY")}
        </InputPanel>
        <InputPanel
          title="qBittorrent"
          startIcon="https://avatars.githubusercontent.com/u/2131270?s=48&v=4"
          status={settings.qBittorrent_active ? "Connected" : "Disconnected"}
        >
          {MUITextFieldHelper("qBittorrent_URL")}
          {MUITextFieldHelper("qBittorrent_username")}
          {MUITextFieldHelper("qBittorrent_password", "password")}
        </InputPanel>
        <InputPanel
          title="Plex"
          startIcon={<Tv aria-hidden="true"/>}
          status={settings.plex_active ? "Connected" : "Disconnected"}
          description={`
            Optional. Lets the Claude AI bot see what people are watching so it can chat about it and make better recommendations.
          `}
        >
          {MUITextFieldHelper("plex_URL")}
          {MUITextFieldHelper("plex_KEY", "password")}
        </InputPanel>
      </div>
      <div className="page-bottom">
        <SaveBar loading={localLoading} status={saveFeedback.status} savedAt={saveFeedback.savedAt} label="Save and check connections"/>
        <Footer/>
      </div>
    </form>
  )
}

export default Connections
