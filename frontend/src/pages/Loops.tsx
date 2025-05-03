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
import MUITextField from "../components/utility/MUITextField/MUITextField"
import { getGroups, getUsers } from "../shared/requests/fileSystemRequests"
import { createChownString } from "../shared/utility"
import MUIAutocomplete from "../components/utility/MUIAutocomplete/MUIAutocomplete"
import TidyPathPicker from "../components/utility/TidyPathPicker/TidyPathPicker"
import Footer from "../components/footer/Footer"

const Loops: React.FC = () => {
  const { settings, setSettings, loading, setLoading } = useContext(AppContext)
  const [ localLoading, setLocalLoading ] = useState<boolean>(false)
  const [ formErr, setFormErr ] = useState<settingsErrorType>(initSettingsErrors())
  const [ user, setUser ] = useState<string | null>(null)
  const [ users, setUsers ] = useState<string[]>([])
  const [ group, setGroup ] = useState<string | null>(null)
  const [ groups, setGroups ] = useState<string[]>([])

  // Get latest settings from db on page load if settings has not been populated
  useEffect(() => {
    if (!settings.updated_at) {
      getSettings(setSettings, setLocalLoading)
    }
  }, [settings, setSettings])

  // Retrieve users of the OS the backend is running on
  useEffect(() => {
    if (users.length === 0) {
      getUsers(setUsers)
    }
  }, [users])

  // Retrieve groups of the OS the backend is running on
  useEffect(() => {
    if (groups.length === 0) {
      getGroups(setGroups)
    }
  }, [groups])

  // Create a chown string from user and group states
  useEffect(() => {
    createChownString(user, group, settings, setSettings)
  }, [user, group, settings, setSettings])

  // initialise user and group autocompletes
  useEffect(() => {
    // Extract user and group from the chown string
    const chown = settings.permissions_change_chown

    if (chown) {
      const [initialUser, initialGroup] = chown.split(":")
      setUser(initialUser || null)
      setGroup(initialGroup || null)
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
    await updateSettings(setLocalLoading, settings, setSettings, formErr)
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
            onBlur={(e) => updateInput(e, setSettings, setFormErr)}
            error={!!formErr.remove_missing_level}
          />, 
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
              options={users}
              value={user}
              setValue={(val) => setUser(val)}
              size="small"
              disabled={!settings.permissions_change}
              onBlur={(e) => {
                checkChownValidity(user, group, setFormErr)
                updateInput(e, setSettings, setFormErr)
              }}
              error={!!formErr.permissions_change_chown}
            />
            <MUIAutocomplete
              label="Group"
              options={groups}
              value={group}
              setValue={val => setGroup(val)}
              size="small"
              disabled={!settings.permissions_change}
              onBlur={(e) => {
                checkChownValidity(user, group, setFormErr)
                updateInput(e, setSettings, setFormErr)
              }}
              error={!!formErr.permissions_change_chown}
            />
            {settingsTextField("permissions_change_chmod", "Permissions", "small", 3, undefined, !settings.permissions_change)}
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
