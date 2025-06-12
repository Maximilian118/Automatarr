import { Button, CircularProgress } from "@mui/material"
import React, { FormEvent, useContext, useEffect, useState } from "react"
import AppContext from "../context"
import { Logout, Send } from "@mui/icons-material"
import InputModel from "../components/model/inputModel/InputModel"
import Footer from "../components/footer/Footer"
import { logout } from "../shared/localStorage"
import SettingsIcon from '@mui/icons-material/Settings';
import { useNavigate } from "react-router-dom"
import { getSettings, updateSettings } from "../shared/requests/settingsRequests"
import { settingsErrorType} from "../types/settingsType"
import { initSettingsErrors, initUserErrors } from "../shared/init"
import Toggle from "../components/utility/Toggle/Toggle"
import MUIAutocomplete from "../components/utility/MUIAutocomplete/MUIAutocomplete"
import { numberSelection, stringSelectionToNumber, toStringWithCap } from "../shared/utility"
import MUITextField from "../components/utility/MUITextField/MUITextField"
import { updateInput } from "../shared/formValidation"
import { UserErrorType } from "../types/userType"
import { updateUser } from "../shared/requests/userRequests"

const Settings: React.FC = () => {
  const { settings, setSettings, user, setUser, loading, setLoading } = useContext(AppContext)
  const [ localLoading, setLocalLoading ] = useState<boolean>(false)
  const [ formErr, setFormErr ] = useState<settingsErrorType>(initSettingsErrors())
  const [ userFormErr, setUserFormErr ] = useState<UserErrorType>(initUserErrors())

  const navigate = useNavigate()
  
  // Get latest settings from db on page load if settings has not been populated
  useEffect(() => {
    if (!settings.updated_at) {
      getSettings(setSettings, user, setUser, setLocalLoading, navigate)
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

  return (
    <>
      <form onSubmit={e => onSubmitHandler(e)}>
        <InputModel 
          title="Settings" 
          startIcon={<SettingsIcon/>}
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
    </>
  )
}

export default Settings
