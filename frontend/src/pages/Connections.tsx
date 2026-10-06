import React, { FormEvent, HTMLInputTypeAttribute, ReactNode, useContext, useEffect, useState } from "react"
import AppContext from "../context"
import { Clapperboard, Download, Newspaper, Tv } from "lucide-react"
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

// A full-width heading that groups connections by what they're for
const sectionHeader = (icon: ReactNode, title: string, description: string) => (
  <div className="grid-section-header">
    <div className="section-title">
      {icon}
      <h2>{title}</h2>
    </div>
    <p>{description}</p>
  </div>
)

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

  const MUITextFieldHelper = (name: keyof settingsType, type?: HTMLInputTypeAttribute, label?: string) => (
    <MUITextField 
      name={name} 
      value={settings[name] as string} 
      formErr={formErr}
      label={label}
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
        {sectionHeader(
          <Clapperboard aria-hidden="true"/>,
          "Media managers",
          "Required. Where your films, series and music live. Automatarr reads their libraries and import lists and sends downloads through them.",
        )}
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
        {sectionHeader(
          <Download aria-hidden="true"/>,
          "Download clients",
          "Live download progress for !list, !waittime and the AI, Discord requests jumping the queue, and seeding-safe cleanup.",
        )}
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
          title="SABnzbd"
          startIcon={<Newspaper aria-hidden="true"/>}
          status={settings.sabnzbd_active ? "Connected" : "Disconnected"}
          description={`
            Optional. Shows real queue positions, progress and time left, and moves Discord requests to the front of the queue.
          `}
        >
          {MUITextFieldHelper("sabnzbd_URL", undefined, "SABnzbd URL")}
          {MUITextFieldHelper("sabnzbd_KEY", "password", "SABnzbd API key")}
        </InputPanel>
        {sectionHeader(
          <Tv aria-hidden="true"/>,
          "Media server",
          "Optional. Who's watching what on Plex, which Radarr and Sonarr can't tell Automatarr.",
        )}
        <InputPanel
          title="Plex"
          startIcon={<Tv aria-hidden="true"/>}
          status={settings.plex_active ? "Connected" : "Disconnected"}
          description={`
            Optional. Keeps anything being watched safe from cleanup, shows "Watched" in !list, and gives the Claude AI bot better recommendations.
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
