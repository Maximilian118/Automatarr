import { Button, CircularProgress } from "@mui/material"
import React, { FormEvent, useContext, useEffect, useState } from "react"
import AppContext from "../context"
import { Send, SettingsSuggest } from "@mui/icons-material"
import { getDiscordChannels, getQualityProfiles, getSettings, updateSettings } from "../shared/requests/settingsRequests"
import Footer from "../components/footer/Footer"
import { BotModel } from "../components/model/botModel/BotModel"
import MUITextField from "../components/utility/MUITextField/MUITextField"
import { initBotErr } from "../shared/init"
import { botsErrType } from "../types/botType"
import { updateInput } from "../shared/formValidation"
import MUIAutocomplete from "../components/utility/MUIAutocomplete/MUIAutocomplete"
import InputModel from "../components/model/inputModel/InputModel"
import { formatBytes, numberSelection, parseBytes, stringSelectionToNumber, toStringWithCap } from "../shared/utility"
import { QualityProfile } from "../types/qualityProfileType"

const Bots: React.FC = () => {
  const { settings, setSettings, loading, setLoading } = useContext(AppContext)
  const [ localLoading, setLocalLoading ] = useState<boolean>(false)
  const [ channelLoading, setChannelLoading ] = useState<boolean>(false)
  const [ qpLoading, setQPLoading ] = useState<boolean>(false)
  const [ formErr, setFormErr ] = useState<botsErrType>(initBotErr)
  const [ qualityProfiles, setQualityProfiles ] = useState<QualityProfile[]>([])
  const [ qpReqSent, setQPReqSent ] = useState<boolean>(false)

  // Get latest settings from db on page load if settings has not been populated
  useEffect(() => {
    if (!settings.updated_at) {
      getSettings(setSettings, setLocalLoading)
    }
  }, [settings, setSettings])

  // Update settings object in db on submit
  const onSubmitHandler = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()

    // Blur selected element on Enter to update state before request
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur()
    }

    await updateSettings(setLocalLoading, settings, setSettings, formErr)
  }

  // On localLoading change, change global loading as well
  useEffect(() => {
    if (localLoading !== loading) {
      setLoading(!loading)
    }
  }, [localLoading, loading, setLoading])

  useEffect(() => {
    if (!qpReqSent && qualityProfiles.length === 0) {
      getQualityProfiles(setQualityProfiles, setQPLoading)
      setQPReqSent(true)
    }
  }, [qualityProfiles, qpReqSent])

  return (
    <form onSubmit={e => onSubmitHandler(e)}>
      <InputModel
        title="General"
        startIcon={<SettingsSuggest/>}
        description={`
          Users must be approved by an admin before accessing the bots, at which point a content pool is created for them.

          Each pool has limits and expiration times for different content types.

          An admin can also assign Super Users, who are exempt from these restrictions.

          Content in user pools cannot be removed via loops.
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
          label="Movie Quality Profile"
          options={qualityProfiles.find(qp => qp.name === "Radarr")?.data.map(qp => qp.name) || []}
          value={settings.general_bot.movie_quality_profile}
          loading={qpLoading}
          disabled={qpLoading}
          setValue={(val) => {
            setSettings(prevSettings => {
              return {
                ...prevSettings,
                general_bot: {
                  ...prevSettings.general_bot,
                  movie_quality_profile: val
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
        <MUIAutocomplete
          label="Series Quality Profile"
          options={qualityProfiles.find(qp => qp.name === "Sonarr")?.data.map(qp => qp.name) || []}
          value={settings.general_bot.series_quality_profile}
          loading={qpLoading}
          disabled={qpLoading}
          setValue={(val) => {
            setSettings(prevSettings => {
              return {
                ...prevSettings,
                general_bot: {
                  ...prevSettings.general_bot,
                  series_quality_profile: val
                }
              }
            })
          }}
        />
        <MUITextField
          name="general_bot.min_free_space"
          label="Minimum Free Space"
          formErr={formErr}
          value={formatBytes(settings.general_bot.min_free_space)}
          onChange={(e) => {
            updateInput(e, setSettings, setFormErr, true)

            setSettings(prevSettings => {
              return {
                ...prevSettings,
                general_bot: {
                  ...prevSettings.general_bot,
                  min_free_space: parseBytes(e.target.value)
                }
              }
            })
          }}
          error={!!formErr.general_bot_min_free_space}
        />
        <MUITextField
          name="general_bot.welcome_message"
          label="Welcome Message"
          formErr={formErr}
          value={settings.general_bot.welcome_message}
          onChange={(e) => updateInput(e, setSettings, setFormErr)}
          error={!!formErr.general_bot_welcome_message}
          multiline={4}
        />
      </InputModel>
      <BotModel 
        title="Discord Bot"
        startIcon="https://avatars.githubusercontent.com/u/1965106?s=200&v=4"
        description={`
          Allow Discord users to add and remove content from the server.
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
          onChange={(e) => updateInput(e, setSettings, setFormErr)}
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
        <MUIAutocomplete
          label="Welcome Channel"
          options={settings.discord_bot.channel_list}
          value={settings.discord_bot.welcome_channel_name}
          disabled={!settings.discord_bot.server_name || settings.discord_bot.channel_list.length === 0 || channelLoading}
          loading={channelLoading}
          setValue={(val) => setSettings(prevSettings => {
            return {
              ...prevSettings,
              discord_bot: {
                ...prevSettings.discord_bot,
                welcome_channel_name: val ?? "",
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