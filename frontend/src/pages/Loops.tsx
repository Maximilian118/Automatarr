import { Button, CircularProgress } from "@mui/material"
import React, { FormEvent, useContext, useEffect, useState } from "react"
import AppContext from "../context"
import { Loop as MuiLoop, Send } from "@mui/icons-material"
import { initSettingsErrors } from "../shared/init"
import { checkChownValidity, inputLabel, updateInput } from "../shared/formValidation"
import { settingsErrorType, settingsType } from "../types/settingsType"
import { getSettings, updateSettings } from "../shared/requests/settingsRequests"
import InputModel from "../components/model/inputModel/InputModel"
import Loop from "../components/loop/Loop"
import LoopTime from "../components/loop/looptime/Looptime"
import { createChownString } from "../shared/utility"
import MUIAutocomplete from "../components/utility/MUIAutocomplete/MUIAutocomplete"
import TidyPathPicker from "../components/utility/TidyPathPicker/TidyPathPicker"
import Footer from "../components/footer/footer"
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
  
  // Get latest settings from db on page load if settings has not been populated
  useEffect(() => {
    if (!settings.updated_at) {
      getSettings(setSettings, user, setUser, setLocalLoading, navigate)
    }
  }, [user, setUser, settings, setSettings, navigate])

  // Retrieve users of the OS the backend is running on
  useEffect(() => {
    if (unixUsers.length === 0) {
      getUnixUsers(user, setUser, navigate, setUnixUsers)
    }
  }, [user.token]) // Only depend on user token to avoid infinite loops

  // Retrieve groups of the OS the backend is running on
  useEffect(() => {
    if (unixGroups.length === 0) {
      getUnixGroups(user, setUser, navigate, setUnixGroups)
    }
  }, [user.token]) // Only depend on user token to avoid infinite loops

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
    await updateSettings(setLocalLoading, settings, setSettings, user, setUser, navigate, formErr)
  }

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
      <InputModel 
        title="Loops" 
        startIcon={<MuiLoop/>}
      >
        {loop(
          "remove_missing",
          "Remove any content in Starr app libraries and file system that does not appear in Import Lists.",
          <MUIAutocomplete
            label="Remove Missing Level"
            options={["Library", "Import List"]}
            value={settings.remove_missing_level}
            setValue={(val) => setSettings(prevSettings => {
              return {
                ...prevSettings,
                remove_missing_level: val as "Library" | "Import List"
              }
            })}
            size="small"
            disabled={!settings.remove_missing || !settings.qBittorrent_active}
            onChange={(e) => updateInput(e, setSettings, setFormErr)}
            error={!!formErr.remove_missing_level}
          />, 
          !settings.qBittorrent_active,
          "qBittorrent Required"
        )}
        {loop(
          "wanted_missing",
          "Start a search for all missing content in the Wanted > Missing tabs.",
        )}
        {loop(
          "remove_blocked",
          "Delete all blocked items in Starr App queues.",
        )}
        {loop(
          "remove_failed",
          "Remove all downloads in qBittorrent download paths that have failed.",
          undefined,
          !settings.qBittorrent_active,
          "qBittorrent Required"
        )}
        {loop(
          "tidy_directories",
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
              label="Pemissions"
              value={settings.permissions_change_chmod}
              onChange={(e) => updateInput(e, setSettings, setFormErr)}
              formErr={formErr}
              size="small"
              maxLength={3}
              disabled={!settings.permissions_change}
            />
          </>
        )}
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

export default Loops
