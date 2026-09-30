import React, { FormEvent, useContext, useEffect, useState } from "react"
import AppContext from "../context"
import { RefreshCw, Wrench } from "lucide-react"
import { initSettingsErrors } from "../shared/init"
import { checkChownValidity, inputLabel, updateInput } from "../shared/formValidation"
import { settingsErrorType, settingsType } from "../types/settingsType"
import { getSettingsWithState, updateSettings } from "../shared/requests/settingsRequests"
import Loop from "../components/loop/Loop"
import LoopStatusLine from "../components/loop/LoopStatusLine/LoopStatusLine"
import PageHeader from "../components/ui/PageHeader/PageHeader"
import SaveBar from "../components/ui/SaveBar/SaveBar"
import { useSaveFeedback } from "../shared/hooks/useSaveFeedback"
import { useLoopStatus } from "../shared/hooks/useLoopStatus"
import LoopTime from "../components/loop/looptime/Looptime"
import { createChownString, formHasErr } from "../shared/utility"
import MUIAutocomplete from "../components/utility/MUIAutocomplete/MUIAutocomplete"
import TidyPathPicker from "../components/utility/TidyPathPicker/TidyPathPicker"
import Footer from "../components/footer/Footer"
import MUITextField from "../components/utility/MUITextField/MUITextField"
import { getUnixGroups, getUnixUsers } from "../shared/requests/fileSystemRequests"
import { useNavigate } from "react-router-dom"

const Loops: React.FC = () => {
  const { user, setUser, settings, setSettings, loading, setLoading } = useContext(AppContext)
  const [ localLoading, setLocalLoading ] = useState<boolean>(false)
  const [ formErr, setFormErr ] = useState<settingsErrorType>(initSettingsErrors())
  const [ unixUser, setUnixUser ] = useState<string | null>(null)
  const [ unixUsers, setUnixUsers ] = useState<string[]>([])
  const [ unixGroup, setUnixGroup ] = useState<string | null>(null)
  const [ unixGroups, setUnixGroups ] = useState<string[]>([])

  const navigate = useNavigate()
  const loopStatus = useLoopStatus()
  const saveFeedback = useSaveFeedback(settings.updated_at, localLoading, "Loops")

  // Get latest settings from db on page load if settings has not been populated
  useEffect(() => {
    if (!settings.updated_at) {
      getSettingsWithState(setSettings, user, setUser, setLocalLoading, navigate)
    }
  }, [user, setUser, settings, setSettings, navigate])

  // Retrieve users of the OS the backend is running on
  useEffect(() => {
    if (unixUsers.length === 0) {
      getUnixUsers(user, setUser, navigate, setUnixUsers)
    }
  }, [user, setUser, navigate, unixUsers])

  // Retrieve groups of the OS the backend is running on
  useEffect(() => {
    if (unixGroups.length === 0) {
      getUnixGroups(user, setUser, navigate, setUnixGroups)
    }
  }, [user, setUser, navigate, unixGroups])

  // Create a chown string from user and group states
  useEffect(() => {
    createChownString(unixUser, unixGroup, settings, setSettings)
  }, [unixUser, unixGroup, settings, setSettings])

  // initialise user and group autocompletes
  useEffect(() => {
    // Extract user and group from the chown string
    const chown = settings.permissions_change_chown

    if (chown) {
      const [initialUser, initialGroup] = chown.split(":")
      setUnixUser(initialUser || null)
      setUnixGroup(initialGroup || null)
    }
  }, [settings])

  // On localLoading change, change global loading as well
  useEffect(() => {
    if (localLoading !== loading) {
      setLoading(!loading)
    }
  }, [localLoading, loading, setLoading])

  // Update settings object in db on submit
  const onSubmitHandler = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    saveFeedback.beginSave(!formHasErr(formErr))
    await updateSettings(setLocalLoading, settings, setSettings, user, setUser, navigate, formErr)
  }

  // Render a loop card with its title, description, toggle, and time picker
  const loop = (
    name: keyof settingsType,
    displayName: string,
    desc?: string,
    params?: JSX.Element,
    disabled?: boolean,
    disabledText?: string
  ) => (
    <Loop
      title={displayName}
      loop={name}
      settings={settings}
      setSettings={setSettings}
      desc={desc}
      disabled={disabled}
      disabledText={disabledText}
      status={<LoopStatusLine status={loopStatus[name]} />}
      params={(
        <>
          <LoopTime
            loop={`${name}_loop` as keyof settingsType}
            settings={settings}
            setSettings={setSettings}
            formErr={formErr}
            setFormErr={setFormErr}
            disabled={!settings[name] || disabled}
            maxUnit="weeks"
          />
          {params}
        </>
      )}
    />
  )

  return (
    <form onSubmit={e => onSubmitHandler(e)}>
      <PageHeader
        title="Loops"
        description="Automatarr's scheduled jobs. Each one runs on its own timer to keep downloads flowing and storage under control."
      />
      <div className="grid-layout">
        {/* Core Loops section header */}
        <div className="grid-section-header">
          <div className="section-title">
            <RefreshCw aria-hidden="true"/>
            <h2>Core loops</h2>
          </div>
          <p>These loops are the heart of Automatarr — they manage your media library lifecycle, handle downloads, and protect user pool content.</p>
        </div>
        {/* Individual core loop cards */}
        {loop(
          "library_cleanup",
          "Library Cleanup",
          "Removes content from your library that no longer appears in your Import Lists. Content in user pools is always protected — only unprotected items are removed. This is the core mechanism that keeps your library lean while respecting what users have explicitly added.",
          <MUIAutocomplete
            label="Library Cleanup Level"
            options={["Library", "Import List"]}
            value={settings.library_cleanup_level}
            setValue={(val) => setSettings(prevSettings => {
              return {
                ...prevSettings,
                library_cleanup_level: val as "Library" | "Import List"
              }
            })}
            size="small"
            disabled={!settings.library_cleanup || !settings.qBittorrent_active}
            onChange={(e) => updateInput(e, setSettings, setFormErr)}
            error={!!formErr.library_cleanup_level}
          />,
          !settings.qBittorrent_active,
          "qBittorrent Required"
        )}
        {loop(
          "content_search",
          "Content Search",
          "Searches for all content marked as wanted but not yet downloaded. Triggers Radarr and Sonarr to find and grab missing movies and episodes so your library stays up to date.",
        )}
        {loop(
          "queue_cleaner",
          "Queue Cleaner",
          "Monitors download queues for stuck, blocked, or problematic items. Automatically removes failed imports, stalled downloads, and format mismatches, then searches for alternatives to keep downloads flowing.",
        )}
        {loop(
          "failed_cleanup",
          "Failed Cleanup",
          "Scans download directories for files marked as failed and removes them from disk, keeping your download folders clean.",
          undefined,
          !settings.qBittorrent_active,
          "qBittorrent Required"
        )}
        {/* Utilities section header */}
        <div className="grid-section-header">
          <div className="section-title">
            <Wrench aria-hidden="true"/>
            <h2>Utilities</h2>
          </div>
          <p>Optional maintenance tasks for filesystem housekeeping.</p>
        </div>
        {/* Individual utility loop cards */}
        {loop(
          "tidy_directories",
          "Tidy Directories",
          "Remove all unwanted files and directories in the provided paths. Only keep children specified in the allowed directories section. Unwanted children will be removed if they still exists after 3 loops.",
          <TidyPathPicker
            label={inputLabel("tidy_directories", formErr, "Directories")}
            paths={settings.tidy_directories_paths}
            setSettings={setSettings}
            setFormErr={setFormErr}
            user={user}
            setUser={setUser}
            navigate={navigate}
            disabled={!settings.tidy_directories}
            error={!!formErr.tidy_directories}
          />
        )}
        {loop(
          "permissions_change",
          "Permissions Change",
          "Change the ownership and permissions of the entire contents of Starr app root folders to the specified user and group.",
          <>
            <MUIAutocomplete
              label="User"
              options={unixUsers}
              value={unixUser}
              setValue={(val) => setUnixUser(val)}
              size="small"
              disabled={!settings.permissions_change}
              onChange={(e) => {
                checkChownValidity(unixUser, unixGroup, setFormErr)
                updateInput(e, setSettings, setFormErr)
              }}
              error={!!formErr.permissions_change_chown}
            />
            <MUIAutocomplete
              label="Group"
              options={unixGroups}
              value={unixGroup}
              setValue={val => setUnixGroup(val)}
              size="small"
              disabled={!settings.permissions_change}
              onChange={(e) => {
                checkChownValidity(unixUser, unixGroup, setFormErr)
                updateInput(e, setSettings, setFormErr)
              }}
              error={!!formErr.permissions_change_chown}
            />
            <MUITextField
              name="permissions_change_chmod"
              label="Permissions"
              value={settings.permissions_change_chmod}
              onChange={(e) => updateInput(e, setSettings, setFormErr)}
              formErr={formErr}
              size="small"
              maxLength={3}
              disabled={!settings.permissions_change}
            />
          </>
        )}
      </div>
      <div className="page-bottom">
        <SaveBar loading={localLoading} status={saveFeedback.status} savedAt={saveFeedback.savedAt}/>
        <Footer/>
      </div>
    </form>
  )
}

export default Loops
