import { Button, CircularProgress, TextField } from "@mui/material"
import React, { FormEvent, useContext, useEffect, useState } from "react"
import AppContext from "../context"
import { ArrowBackIos, Close, Done, Logout, Person, Restore, Send, Settings as SettingsIcon, SettingsBackupRestore, Webhook } from "@mui/icons-material"
import InputModel from "../components/model/inputModel/InputModel"
import Footer from "../components/footer/Footer"
import { logout } from "../shared/localStorage"
import { useNavigate } from "react-router-dom"
import { getSettingsWithState, updateSettings } from "../shared/requests/settingsRequests"
import { EventType, settingsErrorType, settingsType} from "../types/settingsType"
import { initSettingsErrors, initUserErrors } from "../shared/init"
import Toggle from "../components/utility/Toggle/Toggle"
import MUIAutocomplete from "../components/utility/MUIAutocomplete/MUIAutocomplete"
import { anyStarrActive, capsFirstLetter, numberSelection, stringSelectionToNumber, toStringWithCap, webhookURL } from "../shared/utility"
import MUITextField from "../components/utility/MUITextField/MUITextField"
import { inputLabel, updateInput } from "../shared/formValidation"
import { UserErrorType } from "../types/userType"
import { updateUser } from "../shared/requests/userRequests"
import { checkWebhooks } from "../shared/requests/checkAPIRequests"
import LoopTime from "../components/loop/looptime/Looptime"
import { getBackupFile, getBackupFiles } from "../shared/requests/miscRequests"

const Settings: React.FC = () => {
  const { settings, setSettings, user, setUser, loading, setLoading } = useContext(AppContext)
  const [ localLoading, setLocalLoading ] = useState<boolean>(false)
  const [ formErr, setFormErr ] = useState<settingsErrorType>(initSettingsErrors())
  const [ userFormErr, setUserFormErr ] = useState<UserErrorType>(initUserErrors())
  const [ webhooksConnected, setWebhooksConnected ] = useState<("Radarr" | "Sonarr" | "Lidarr")[]>([])
  const [ webhooksLoading, setWebhooksLoading ] = useState<boolean>(false)
  const [ backupFileNames, setBackupFileNames ] = useState<string[]>([])
  const [ backupFileName, setBackupFileName ] = useState<string | null>(null)
  const [ backupFileLoading, setBackupFileLoading ] = useState<boolean>(false)
  const [ backupFileErr, setBackupFileErr ] = useState<string>("")
  const [ backupBtnClicked, setBackupBtnClicked ] = useState<boolean>(false)

  const navigate = useNavigate()

  useEffect(() => {
    const onPageLoadHandler = async () => {
      setWebhooksConnected(await checkWebhooks(user, setUser, setWebhooksLoading, navigate, webhookURL(settings)))
      setBackupFileNames(await getBackupFiles(user, setUser, navigate, setBackupFileLoading))
    }

    onPageLoadHandler()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  
  // Get latest settings from db on page load if settings has not been populated
  useEffect(() => {
    if (!settings.updated_at) {
      getSettingsWithState(setSettings, user, setUser, setLocalLoading, navigate)
    }
  }, [user, setUser, settings, setSettings, navigate])

  // Update settings object in db on submit
  const onSubmitHandler = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    await updateSettings(setLocalLoading, settings, setSettings, user, setUser, navigate, formErr)
    await updateUser(user, setUser, setUserFormErr, setLocalLoading, navigate)
  }

  // On localLoading change, change global loading as well
  useEffect(() => {
    if (localLoading !== loading) {
      setLoading(!loading)
    }
  }, [localLoading, loading, setLoading])

  const webhookURLInvalid = webhookURL(settings).includes("Invalid")
  const anyStarrAct = anyStarrActive(settings)

  const webhookNotificationType = (type: EventType) => (
    <Toggle 
      name={`${capsFirstLetter(type)} Notifications:`}
      checked={anyStarrAct ? settings.webhooks_enabled.includes(type) : false}
      disabled={!anyStarrAct || webhookURLInvalid}
      onToggle={() =>
        setSettings(prevSettings => {
          const enabled = prevSettings.webhooks_enabled.includes(type)

          return {
            ...prevSettings,
            webhooks_enabled: enabled
              ? prevSettings.webhooks_enabled.filter(e => e !== type)
              : [...prevSettings.webhooks_enabled, type],
          }
        })
      }
    />
  )

  const apiConnection = (src: string, link: string, connected: boolean) => (
    <div className="api-connection">
      <img alt="API Symbol" src={src} onClick={() => window.open(link, '_blank')}/>
      {webhooksLoading ? <CircularProgress size={20}/> : connected ? <Done color="success"/> : <Close color="error"/>}
    </div>
  )

  return (
    <>
      <form onSubmit={e => onSubmitHandler(e)}>
        <InputModel
          title="Backups" 
          startIcon={<SettingsBackupRestore/>}
          description={`Backup your settings and user pool data to the path assigned in the docker-compose.yml file.`}
          checked={settings.backups}
          onToggle={() => {
            setSettings(prevSettings => {
              return {
                ...prevSettings,
                backups: !prevSettings.backups,
              }
            })
          }}
        >
          <h4>Backup Frequency</h4>
          <LoopTime
            loop={"backups_loop" as keyof settingsType}
            settings={settings}
            setSettings={setSettings}
            formErr={formErr}
            setFormErr={setFormErr}
            maxUnit="weeks"
            minUnit="hours"
          />
          <h4>Retention Period</h4>
          <LoopTime
            loop={"backups_rotation_date" as keyof settingsType}
            settings={settings}
            setSettings={setSettings}
            formErr={formErr}
            setFormErr={setFormErr}
            minUnit="weeks"
          />
          <h4 style={{ marginTop: 30 }}>Restore</h4>
          <MUIAutocomplete
            label={`Restore File${backupFileErr ? `: ${backupFileErr}` : ""}`}
            options={backupFileNames}
            disabled={backupFileLoading}
            value={backupFileName}
            setValue={(val) => setBackupFileName(val)}
            loading={backupFileLoading}
            error={!!backupFileErr}
          />
          <div className="model-row" style={{ justifyContent: backupBtnClicked ? "space-between" : "center" }}>
            {backupBtnClicked && (
              <>
                <h4 style={{ width: "auto" }}>Are you sure?!</h4>
                <Button
                  variant="contained"
                  color={"error"}
                  endIcon={<ArrowBackIos color="inherit"/>}
                  onClick={() => {
                    setBackupFileName(null)
                    setBackupBtnClicked(false)
                  }}
                >Back</Button>
              </>
            )}
            <Button
              variant="contained"
              color={backupFileErr ? "error" : "primary"}
              disabled={backupFileLoading || backupFileNames.length === 0 || !backupFileName}
              endIcon={<Restore/>}
              onClick={async () => {
                if (!backupFileName) {
                  console.log("No backup file name")
                  return
                }

                if (!backupBtnClicked) {
                  setBackupBtnClicked(true)
                  return
                }

                await getBackupFile(
                  user,
                  setUser, 
                  navigate, 
                  setBackupFileLoading, 
                  backupFileName,
                  setBackupFileName,
                  setSettings, 
                  setBackupFileErr,
                  setBackupBtnClicked
                )
              }}
            >Restore</Button>
          </div>
        </InputModel>
        <InputModel 
          title="User Settings" 
          startIcon={<Person/>}
        >
          <Toggle 
            name="Lockout Security:" 
            checked={settings.lockout} 
            onToggle={() => setSettings(prevSettings => {
              return {
                ...prevSettings,
                lockout: !prevSettings.lockout,
              }
            })}
          />
          <MUIAutocomplete
            label="Lockout Attempts"
            options={numberSelection()}
            value={toStringWithCap(settings.lockout_attempts, 99, "Infinite")}
            setValue={(val) => {
              setSettings(prevSettings => {
                return {
                  ...prevSettings,
                  lockout_attempts: val ? stringSelectionToNumber(val) : prevSettings.lockout_attempts,
                }
              })
            }}
          />
          <MUITextField
            onlyNumbers
            name="lockout_mins"
            label="Lockout Time (Mins)"
            value={settings.lockout_mins === Infinity ? "" : String(settings.lockout_mins)}
            formErr={formErr}
            onChange={(e) => {
              setSettings(prev => ({
                ...prev,
                lockout_mins: e.target.value === "Infinity" ? Infinity : parseInt(e.target.value, 10),
              }))

              if (formErr.lockout_mins) {
                setFormErr(prevErrs => ({
                  ...prevErrs,
                  lockout_mins: "",
                }))
              }
            }}
            onBlur={(e) => updateInput(e, setSettings, setFormErr, true)}
          />
           <MUITextField
            name="name"
            label="User Name"
            value={user.name}
            formErr={userFormErr}
            onChange={(e) => {
              setUser(prev => ({
                ...prev,
                name: e.target.value,
              }))

              if (userFormErr.name) {
                setUserFormErr(prevErrs => ({
                  ...prevErrs,
                  name: "",
                }))
              }
            }}
          />
          <MUITextField
            name="password"
            label="New Password"
            value={user.password}
            formErr={userFormErr}
            onChange={(e) => {
              setUser(prev => ({
                ...prev,
                password: e.target.value,
              }))

              if (userFormErr.password) {
                setUserFormErr(prevErrs => ({
                  ...prevErrs,
                  password: "",
                }))
              }
            }}
            onBlur={(e) => updateInput(e, setUser, setUserFormErr)}
            type="password"
          />
          <MUITextField
            name="password_check"
            label="Confirm New Password"
            value={user.password_check}
            formErr={userFormErr}
            onChange={(e) => {
              setUser(prev => ({
                ...prev,
                password_check: e.target.value,
              }))

              if (userFormErr.password_check) {
                setUserFormErr(prevErrs => ({
                  ...prevErrs,
                  password_check: "",
                }))
              }
            }}
            onBlur={(e) => updateInput(e, setUser, setUserFormErr)}
            type="password"
          />
        </InputModel>
        <InputModel
          title="Webhooks" 
          startIcon={<Webhook/>}
          description={`Webhooks allow you to send specific notifications through your bots.

            For example, the "Imported" notification will alert users when a movie they've downloaded is ready to watch.
            
            Note: Without Webhooks users will still receive "Imported" notifications by Polling Starr apps.

            Setup: Copy and paste the below URL into: Starr App > Settings > Connect > Webhook > Webhook URL. Test it and press save.

            Alternatively, just press the "Add Connections" below to connect all active Starr Apps.
          `}
          checked={anyStarrAct ? settings.webhooks : false}
          disabled={!anyStarrAct || webhookURLInvalid}
          onToggle={() => {
            setSettings(prevSettings => {
              return {
                ...prevSettings,
                webhooks_active: !prevSettings.webhooks,
              }
            })
          
            if (formErr.webhooks_token) { 
              setFormErr(prevFormErr => {
                return {
                  ...prevFormErr,
                  webhooks_token: "",
                }
              })
            }
          }}
        >
          <div className="button-bar" style={{ width: "100%", justifyContent: "space-between", marginBottom: 39.5 }}>
            <Button 
              variant="contained"
              endIcon={localLoading ? 
                <CircularProgress size={20} color="inherit"/> : 
                <Webhook color="inherit"/>
              }
              disabled={!anyStarrAct || webhookURLInvalid}
              onClick={async () => setWebhooksConnected(await checkWebhooks(user, setUser, setWebhooksLoading, navigate, webhookURL(settings)))}
            >Add Connections</Button>
            <div className="api-connections-bar">
              {apiConnection("https://radarr.video/img/logo.png", settings.radarr_URL, webhooksConnected.includes("Radarr"))}
              {apiConnection("https://sonarr.tv/img/logo.png", settings.sonarr_URL, webhooksConnected.includes("Sonarr"))}
              {apiConnection("https://lidarr.audio/img/logo.png", settings.lidarr_URL, webhooksConnected.includes("Lidarr"))}
            </div>
          </div>
          <TextField
            fullWidth
            value={webhookURL(settings)}
            label={settings.webhooks ? inputLabel("webhooks_token", formErr, "Webhook URL") : ""}
            slotProps={{ input: {readOnly: true } }}
            error={webhookURLInvalid && settings.webhooks}
            disabled={!anyStarrAct || !settings.webhooks}
          />
          {webhookNotificationType("Import")}
          {webhookNotificationType("Grab")}
        </InputModel>
        <InputModel
          title="Advanced"
          startIcon={<SettingsIcon/>}
          description={`Advanced system settings for experienced users. These settings control internal system behavior and should be used with caution.`}
        >
          <Toggle 
            name="User Pool Content Checker:"
            checked={settings.user_pool_checker}
            onToggle={() =>
              setSettings(prevSettings => ({
                ...prevSettings,
                user_pool_checker: !prevSettings.user_pool_checker
              }))
            }
          />
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
      </form>
      <div className="bottom">
        <Button 
          variant="contained"
          sx={{ margin: "20px 0" }}
          endIcon={localLoading ? 
            <CircularProgress size={20} color="inherit"/> : 
            <Logout color="inherit"/>
          }
          color="error"
          onClick={() => logout(setUser, navigate)}
        >Logout</Button>
        <Footer/>
      </div>
    </>
  )
}

export default Settings
