import axios from "axios"
import { Dispatch, SetStateAction } from "react"
import { settingsType } from "../../types/settingsType"
import { populateSettings } from "./requestPopulation"
import { checkAPIs, formHasErr } from "../utility"
import { QualityProfile } from "../../types/qualityProfileType"
import { authCheck, headers } from "./requestUtility"
import { UserType } from "../../types/userType"
import { NavigateFunction } from "react-router-dom"

export const getSettings = async (
  setSettings: Dispatch<SetStateAction<settingsType>>,
  user: UserType,
  setUser: Dispatch<SetStateAction<UserType>>,
  setLoading: Dispatch<SetStateAction<boolean>>,
  navigate: NavigateFunction,
  checkConnections?: boolean,
): Promise<void> => {
  setLoading(true)

  try {
    const res = await axios.post(
      "",
      {
        query: `
        query {
          getSettings {
            ${populateSettings}
          }
        }
      `,
      },
      { headers: headers(user.token) },
    )

    if (res.data.errors) {
      authCheck(res.data.errors, setUser, navigate)
      console.error(`getSettings Error: ${res.data.errors[0].message}`)
    } else {
      const settings = res.data.data.getSettings // Check all API's with the latest credentials
      setSettings(
        checkConnections ? await checkAPIs(user, setUser, navigate, settings, true) : settings,
      )
      console.log(`getSettings: Settings retrieved.`)
    }
  } catch (err) {
    console.error(`getSettings Error: ${err}`)
  } finally {
    setLoading(false)
  }
}

export const updateSettings = async (
  setLoading: Dispatch<SetStateAction<boolean>>,
  settings: settingsType,
  setSettings: Dispatch<SetStateAction<settingsType>>,
  user: UserType,
  setUser: Dispatch<SetStateAction<UserType>>,
  navigate: NavigateFunction,
  formErr: Record<string, string | undefined>,
): Promise<void> => {
  setLoading(true)

  if (formHasErr(formErr)) {
    setLoading(false)
    console.error("updateSettings: Form has errors.")
    return
  }

  try {
    const res = await axios.post(
      "",
      {
        variables: await checkAPIs(user, setUser, navigate, settings, true), // Check all API's with the latest credentials
        query: `
        mutation UpdateSettings( 
          $_id: ID!
          $radarr_URL: String
          $radarr_KEY: String
          $radarr_API_version: String
          $radarr_active: Boolean
          $sonarr_URL: String
          $sonarr_KEY: String
          $sonarr_API_version: String
          $sonarr_active: Boolean
          $lidarr_URL: String
          $lidarr_KEY: String
          $lidarr_API_version: String
          $lidarr_active: Boolean
          $remove_blocked: Boolean
          $wanted_missing: Boolean
          $remove_failed: Boolean
          $remove_missing: Boolean
          $permissions_change: Boolean
          $tidy_directories: Boolean
          $remove_blocked_loop: Int
          $wanted_missing_loop: Int
          $remove_failed_loop: Int
          $remove_missing_loop: Int
          $remove_missing_level: String
          $permissions_change_loop: Int
          $permissions_change_chown: String
          $permissions_change_chmod: String
          $tidy_directories_loop: Int
          $tidy_directories_paths: [tidyPaths!]!
          $qBittorrent_URL: String
          $qBittorrent_username: String
          $qBittorrent_password: String
          $qBittorrent_active: Boolean
          $qBittorrent_API_version: String
          $general_bot: generalBot
          $discord_bot: discordBot
          $lockout: Boolean
          $lockout_attempts: Int
          $lockout_mins: Int
        ) {
          updateSettings(settingsInput: {  
            _id: $_id
            radarr_URL: $radarr_URL
            radarr_KEY: $radarr_KEY
            radarr_API_version: $radarr_API_version
            radarr_active: $radarr_active
            sonarr_URL: $sonarr_URL
            sonarr_KEY: $sonarr_KEY
            sonarr_API_version: $sonarr_API_version
            sonarr_active: $sonarr_active
            lidarr_URL: $lidarr_URL
            lidarr_KEY: $lidarr_KEY
            lidarr_API_version: $lidarr_API_version
            lidarr_active: $lidarr_active
            remove_blocked: $remove_blocked
            wanted_missing: $wanted_missing
            remove_failed: $remove_failed
            remove_missing: $remove_missing
            permissions_change: $permissions_change
            tidy_directories: $tidy_directories
            remove_blocked_loop: $remove_blocked_loop
            wanted_missing_loop: $wanted_missing_loop
            remove_failed_loop: $remove_failed_loop
            remove_missing_loop: $remove_missing_loop
            remove_missing_level: $remove_missing_level
            permissions_change_loop: $permissions_change_loop
            permissions_change_chown: $permissions_change_chown
            permissions_change_chmod: $permissions_change_chmod
            tidy_directories_loop: $tidy_directories_loop
            tidy_directories_paths: $tidy_directories_paths
            qBittorrent_URL: $qBittorrent_URL
            qBittorrent_username: $qBittorrent_username
            qBittorrent_password: $qBittorrent_password
            qBittorrent_active: $qBittorrent_active
            qBittorrent_API_version: $qBittorrent_API_version
            general_bot: $general_bot
            discord_bot: $discord_bot
            lockout: $lockout
            lockout_attempts: $lockout_attempts
            lockout_mins: $lockout_mins
          }) {
            ${populateSettings}
          }
        }
      `,
      },
      { headers: headers(user.token) },
    )

    if (res.data.errors) {
      authCheck(res.data.errors, setUser, navigate)
      console.error(`updateSettings Error: ${res.data.errors[0].message}`)
    } else {
      setSettings(res.data.data.updateSettings)
      console.log(`updateSettings: Settings updated.`)
    }
  } catch (err) {
    console.error(`updateSettings Error: ${err}`)
  } finally {
    setLoading(false)
  }
}

export const getDiscordChannels = async (
  setSettings: Dispatch<SetStateAction<settingsType>>,
  user: UserType,
  setUser: Dispatch<SetStateAction<UserType>>,
  navigate: NavigateFunction,
  setLoading: Dispatch<SetStateAction<boolean>>,
  server_name: string | null,
): Promise<void> => {
  if (!server_name) {
    setSettings((prevSettings) => {
      return {
        ...prevSettings,
        discord_bot: {
          ...prevSettings.discord_bot,
          channel_list: [],
          movie_channel_name: "",
          series_channel_name: "",
          music_channel_name: "",
          books_channel_name: "",
        },
      }
    })

    return
  }

  setLoading(true)

  try {
    const res = await axios.post(
      "",
      {
        variables: {
          server_name,
        },
        query: `
        query GetDiscordChannels($server_name: String!) {
          getDiscordChannels(server_name: $server_name) {
            data
            tokens
          }
        }
      `,
      },
      { headers: headers(user.token) },
    )

    if (res.data.errors) {
      authCheck(res.data.errors, setUser, navigate)
      console.error(`getDiscordChannels Error: ${res.data.errors[0].message}`)
    } else {
      setSettings((prevSettings) => {
        return {
          ...prevSettings,
          discord_bot: {
            ...prevSettings.discord_bot,
            channel_list: res.data.data.getDiscordChannels.data,
          },
        }
      })

      console.log(`getDiscordChannels: Discord channels retrieved for ${server_name}.`)
    }
  } catch (err) {
    console.error(`getDiscordChannels Error: ${err}`)
  } finally {
    setLoading(false)
  }
}

export const getQualityProfiles = async (
  setQualityProfiles: Dispatch<SetStateAction<QualityProfile[]>>,
  setQPLoading: Dispatch<SetStateAction<boolean>>,
  user: UserType,
  setUser: Dispatch<SetStateAction<UserType>>,
  navigate: NavigateFunction,
): Promise<void> => {
  setQPLoading(true)

  try {
    const res = await axios.post(
      "",
      {
        query: `
        query {
          getQualityProfiles {
            data {
              name
              data {
                name
                id
              }
            }
            tokens
          }
        }
      `,
      },
      { headers: headers(user.token) },
    )

    if (res.data.errors) {
      authCheck(res.data.errors, setUser, navigate)
      console.error(`getQualityProfiles Error: ${res.data.errors[0].message}`)
    } else {
      setQualityProfiles(res.data.data.getQualityProfiles.data as QualityProfile[])
      console.log(`getQualityProfiles: Quality Profiles retrieved.`)
    }
  } catch (err) {
    console.error(`getQualityProfiles Error: ${err}`)
  } finally {
    setQPLoading(false)
  }
}
