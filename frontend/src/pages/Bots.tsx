import { Button, CircularProgress } from "@mui/material"
import React, { FormEvent, useContext, useEffect, useState } from "react"
import AppContext from "../context"
import { Send, SettingsSuggest } from "@mui/icons-material"
import { getDiscordChannels, getSettings, updateSettings } from "../shared/requests/settingsRequests"
import Footer from "../components/footer/Footer"
import { BotModel } from "../components/model/botModel/BotModel"
import MUITextField from "../components/utility/MUITextField/MUITextField"
import { initBotErr } from "../shared/init"
import { botsErrType } from "../types/botType"
import { updateInput } from "../shared/formValidation"
import MUIAutocomplete from "../components/utility/MUIAutocomplete/MUIAutocomplete"
import InputModel from "../components/model/inputModel/InputModel"
import { numberSelection, stringSelectionToNumber, toStringWithCap } from "../shared/utility"

const Bots: React.FC = () => {
  const { settings, setSettings, loading, setLoading } = useContext(AppContext)
  const [ localLoading, setLocalLoading ] = useState<boolean>(false)
  const [ channelLoading, setChannelLoading ] = useState<boolean>(false)
  const [ formErr, setFormErr ] = useState<botsErrType>(initBotErr)

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

  return (
    <form onSubmit={e => onSubmitHandler(e)}>
      <InputModel
        title="General"
        startIcon={<SettingsSuggest/>}
        description={`
          Users must be approved by an admin before accessing the bots, at which point a content pool is created for them.

          Each pool has limits and expiration times for different content types.

          The admin can also assign Super Users, who are exempt from these restrictions.
        `}
      >
        <MUIAutocomplete
          label="Max Movies"
          options={numberSelection()}
          value={toStringWithCap(settings.general_bot.max_movies, 99, "Infinite")}
          setValue={(val) => {
            setSettings(prevSettings => {
              return {
                ...prevSettings,
                general_bot: {
                  ...prevSettings.general_bot,
                  max_movies: val ? stringSelectionToNumber(val) : prevSettings.general_bot.max_movies
                }
              }
            })
          }}
        />
        <MUIAutocomplete
          label="Movie Expiration Time (days)"
          options={numberSelection()}
          value={toStringWithCap(settings.general_bot.movie_pool_expiry, 99, "Infinite")}
          setValue={(val) => {
            setSettings(prevSettings => {
              return {
                ...prevSettings,
                general_bot: {
                  ...prevSettings.general_bot,
                  movie_pool_expiry: val ? stringSelectionToNumber(val) : prevSettings.general_bot.movie_pool_expiry
                }
              }
            })
          }}
        />
        <MUIAutocomplete
          label="Max Series"
          options={numberSelection()}
          value={toStringWithCap(settings.general_bot.max_series, 99, "Infinite")}
          setValue={(val) => {
            setSettings(prevSettings => {
              return {
                ...prevSettings,
                general_bot: {
                  ...prevSettings.general_bot,
                  max_series: val ? stringSelectionToNumber(val) : prevSettings.general_bot.max_series
                }
              }
            })
          }}
        />
        <MUIAutocomplete
          label="Series Expiration Time (days)"
          options={numberSelection()}
          value={toStringWithCap(settings.general_bot.series_pool_expiry, 99, "Infinite")}
          setValue={(val) => {
            setSettings(prevSettings => {
              return {
                ...prevSettings,
                general_bot: {
                  ...prevSettings.general_bot,
                  series_pool_expiry: val ? stringSelectionToNumber(val) : prevSettings.general_bot.series_pool_expiry
                }
              }
            })
          }}
        />
      </InputModel>
      <BotModel 
        title="Discord Bot"
        startIcon="https://avatars.githubusercontent.com/u/1965106?s=200&v=4"
        description={`
          Allow Discord users to add and remove content from the server.

          For every user that is accepted by the admin, a pool is created for that user.

          By default a user pool has a maximum of 10 Movies and 2 Series with no expiration.

          All content in user pools cannot be removed with loops.
        `}
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
        <MUITextField
          name="discord_bot.token"
          label="Token"
          formErr={formErr}
          value={settings.discord_bot.token}
          onBlur={(e) => updateInput(e, setSettings, setFormErr)}
          error={!!formErr.discord_bot_token}
          color={settings.discord_bot.ready ? "success" : "primary"}
        />
        <MUIAutocomplete
          label="Server"
          options={settings.discord_bot.server_list}
          value={settings.discord_bot.server_name}
          disabled={!settings.discord_bot.token}
          setValue={(val) => {
            setSettings(prevSettings => {
              return {
                ...prevSettings,
                discord_bot: {
                  ...prevSettings.discord_bot,
                  server_name: val ?? "",
                }
              }
            })

            getDiscordChannels(setSettings, setChannelLoading, val)
          }}
        />
        <MUIAutocomplete
          label="Movie Channel"
          options={settings.discord_bot.channel_list}
          value={settings.discord_bot.movie_channel_name}
          disabled={!settings.discord_bot.server_name || settings.discord_bot.channel_list.length === 0 || channelLoading}
          loading={channelLoading}
          setValue={(val) => setSettings(prevSettings => {
            return {
              ...prevSettings,
              discord_bot: {
                ...prevSettings.discord_bot,
                movie_channel_name: val ?? "",
              }
            }
          })}
        />
        <MUIAutocomplete
          label="Series Channel"
          options={settings.discord_bot.channel_list}
          value={settings.discord_bot.series_channel_name}
          disabled={!settings.discord_bot.server_name || settings.discord_bot.channel_list.length === 0 || channelLoading}
          loading={channelLoading}
          setValue={(val) => setSettings(prevSettings => {
            return {
              ...prevSettings,
              discord_bot: {
                ...prevSettings.discord_bot,
                series_channel_name: val ?? "",
              }
            }
          })}
        />
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