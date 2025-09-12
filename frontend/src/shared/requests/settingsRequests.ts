import axios from "axios"
import { Dispatch, SetStateAction } from "react"
import { settingsType } from "../../types/settingsType"
import { populateSettings } from "./requestPopulation"
import { checkAPIs, formHasErr } from "../utility"
import { QualityProfile } from "../../types/qualityProfileType"
import { authCheck, getAxiosErrorMessage, handleResponseTokens, headers } from "./requestUtility"
import { UserType } from "../../types/userType"
import { NavigateFunction } from "react-router-dom"

// Simple version for Users page
export const getSettings = async (): Promise<settingsType> => {
  try {
    const userToken = localStorage.getItem('token')
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
      { headers: headers(userToken || '') },
    )

    if (res.data.errors) {
      console.error(`getSettings Error: ${res.data.errors[0].message}`)
      throw new Error(res.data.errors[0].message)
    } else {
      console.log(`getSettings: Settings retrieved.`)
      return res.data.data.getSettings
    }
  } catch (err) {
    console.error(getAxiosErrorMessage(err))
    throw err
  }
}

// Original version with state setters
export const getSettingsWithState = async (
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
      const settings = handleResponseTokens(res.data.data.getSettings, setUser)
      // Check all API's with the latest credentials
      setSettings(
        checkConnections ? await checkAPIs(user, setUser, navigate, settings, true) : settings,
      )
      console.log(`getSettings: Settings retrieved.`)
    }
  } catch (err) {
    console.error(getAxiosErrorMessage(err))
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
    const checkedSettings = await checkAPIs(user, setUser, navigate, settings, true)
    // Remove users from general_bot for the GraphQL mutation since users field is not in the input schema
    const { users, ...general_bot_without_users } = checkedSettings.general_bot
    const settingsForUpdate = { ...checkedSettings, general_bot: general_bot_without_users }
    
    const res = await axios.post(
      "",
      {
        variables: settingsForUpdate,
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
          $webhooks: Boolean
          $webhooks_enabled: [String!]!
          $backups: Boolean
          $backups_loop: Int
          $backups_rotation_date: Int
          $user_pool_checker: Boolean
          $user_pool_checker_loop: Int
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
            webhooks: $webhooks
            webhooks_enabled: $webhooks_enabled
            backups: $backups 
            backups_loop: $backups_loop
            backups_rotation_date: $backups_rotation_date
            user_pool_checker: $user_pool_checker
            user_pool_checker_loop: $user_pool_checker_loop
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
      setSettings(handleResponseTokens(res.data.data.updateSettings, setUser))
      console.log(`updateSettings: Settings updated.`)
    }
  } catch (err) {
    console.error(getAxiosErrorMessage(err))
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
      handleResponseTokens(res.data.data.getDiscordChannels, setUser)

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
    console.error(getAxiosErrorMessage(err))
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
      handleResponseTokens(res.data.data.getQualityProfiles, setUser)
      setQualityProfiles(res.data.data.getQualityProfiles.data as QualityProfile[])
      console.log(`getQualityProfiles: Quality Profiles retrieved.`)
    }
  } catch (err) {
    console.error(getAxiosErrorMessage(err))
  } finally {
    setQPLoading(false)
  }
}

export const removePoolItem = async (
  userId: string,
  itemType: "movies" | "series",
  itemIndex: number
): Promise<settingsType> => {
  try {
    const userToken = localStorage.getItem('token')
    const res = await axios.post(
      "",
      {
        variables: {
          userId,
          itemType,
          itemIndex
        },
        query: `
          mutation RemovePoolItem($userId: String!, $itemType: String!, $itemIndex: Int!) {
            removePoolItem(userId: $userId, itemType: $itemType, itemIndex: $itemIndex) {
              ${populateSettings}
            }
          }
        `,
      },
      { headers: headers(userToken || '') },
    )

    if (res.data.errors) {
      console.error(`removePoolItem Error: ${res.data.errors[0].message}`)
      throw new Error(res.data.errors[0].message)
    } else {
      console.log(`removePoolItem: Pool item removed successfully.`)
      return res.data.data.removePoolItem
    }
  } catch (err) {
    console.error(getAxiosErrorMessage(err))
    throw err
  }
}

export const deleteUser = async (userId: string): Promise<settingsType> => {
  try {
    const userToken = localStorage.getItem('token')
    const res = await axios.post(
      "",
      {
        variables: {
          userId
        },
        query: `
          mutation DeleteUser($userId: String!) {
            deleteUser(userId: $userId) {
              ${populateSettings}
            }
          }
        `,
      },
      { headers: headers(userToken || '') },
    )

    if (res.data.errors) {
      console.error(`deleteUser Error: ${res.data.errors[0].message}`)
      throw new Error(res.data.errors[0].message)
    } else {
      console.log(`deleteUser: User deleted successfully.`)
      return res.data.data.deleteUser
    }
  } catch (err) {
    console.error(getAxiosErrorMessage(err))
    throw err
  }
}

export const updateUserStatus = async (
  userId: string, 
  admin?: boolean, 
  superUser?: boolean
): Promise<settingsType> => {
  try {
    const userToken = localStorage.getItem('token')
    const res = await axios.post(
      "",
      {
        variables: {
          userId,
          admin,
          superUser
        },
        query: `
          mutation UpdateUserStatus($userId: String!, $admin: Boolean, $superUser: Boolean) {
            updateUserStatus(userId: $userId, admin: $admin, superUser: $superUser) {
              ${populateSettings}
            }
          }
        `,
      },
      { headers: headers(userToken || '') },
    )

    if (res.data.errors) {
      console.error(`updateUserStatus Error: ${res.data.errors[0].message}`)
      throw new Error(res.data.errors[0].message)
    } else {
      console.log(`updateUserStatus: User status updated successfully.`)
      return res.data.data.updateUserStatus
    }
  } catch (err) {
    console.error(getAxiosErrorMessage(err))
    throw err
  }
}

export const updateUserOverwrites = async (
  userId: string,
  maxMoviesOverwrite?: number | null,
  maxSeriesOverwrite?: number | null
): Promise<settingsType> => {
  try {
    const userToken = localStorage.getItem('token')
    const res = await axios.post(
      "",
      {
        variables: {
          userId,
          maxMoviesOverwrite,
          maxSeriesOverwrite
        },
        query: `
          mutation UpdateUserOverwrites($userId: String!, $maxMoviesOverwrite: Int, $maxSeriesOverwrite: Int) {
            updateUserOverwrites(userId: $userId, maxMoviesOverwrite: $maxMoviesOverwrite, maxSeriesOverwrite: $maxSeriesOverwrite) {
              ${populateSettings}
            }
          }
        `,
      },
      { headers: headers(userToken || '') },
    )

    if (res.data.errors) {
      console.error(`updateUserOverwrites Error: ${res.data.errors[0].message}`)
      throw new Error(res.data.errors[0].message)
    } else {
      console.log(`updateUserOverwrites: User overwrites updated successfully.`)
      return res.data.data.updateUserOverwrites
    }
  } catch (err) {
    console.error(getAxiosErrorMessage(err))
    throw err
  }
}
