import { Button, CircularProgress } from "@mui/material"
import React, { FormEvent, useContext, useEffect, useState } from "react"
import AppContext from "../context"
import { Send } from "@mui/icons-material"
import { initSettingsErrors } from "../shared/init"
import { settingsErrorType, settingsType } from "../types/settingsType"
import { getSettings, updateSettings } from "../shared/requests/settingsRequests"
import Footer from "../components/footer/Footer"
import { BotModel } from "../components/model/botModel/BotModel"
import { textField } from "../shared/formUtility"

const Bots: React.FC = () => {
  const { settings, setSettings, loading, setLoading } = useContext(AppContext)
  const [ localLoading, setLocalLoading ] = useState<boolean>(false)
  const [ formErr, setFormErr ] = useState<settingsErrorType>(initSettingsErrors())

  // Get latest settings from db on page load if settings has not been populated
  useEffect(() => {
    if (!settings.updated_at) {
      getSettings(setSettings, setLocalLoading)
    }
  }, [settings, setSettings])

  // Update settings object in db on submit
  const onSubmitHandler = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    await updateSettings(setLocalLoading, settings, setSettings, formErr)
  }

  // On localLoading change, change global loading as well
  useEffect(() => {
    if (localLoading !== loading) {
      setLoading(!loading)
    }
  }, [localLoading, loading, setLoading])

  const textFieldHelper = (name: string, label?: string, disabled?: boolean, value?: string) => 
    textField(name as keyof settingsType, settings, setSettings, formErr, setFormErr, label, undefined, undefined, undefined, disabled, value)
  
  const discord = settings.discord_bot

  return (
    <form onSubmit={e => onSubmitHandler(e)}>
      <BotModel 
        title="Discord Bot" 
        startIcon="https://avatars.githubusercontent.com/u/1965106?s=200&v=4"
        status={settings.discord_bot.ready ? "Connected" : "Disconnected"}
        active={settings.discord_bot.active}
        onToggle={(value: boolean) =>
          setSettings(prev => ({
            ...prev,
            discord_bot: {
              ...prev.discord_bot,
              active: value
            }
          }))
        }
      >
        {textFieldHelper("discord_bot_token", "Token", !discord.active, discord.token)}
        {textFieldHelper("discord_bot_server_name", "Server Name", !discord.active, discord.server_name)}
        {textFieldHelper("discord_bot_channel_id", "Channel Name", !discord.active, discord.channel_name)}
      </BotModel>
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

export default Bots