import axios from "axios"
import { Dispatch, SetStateAction } from "react"
import { settingsErrorType, settingsType } from "../../types/settingsType"
import { populateSettings } from "./requestPopulation"
import { checkAPIs, formHasErr } from "../utility"

export const getSettings = async (
  setSettings: Dispatch<SetStateAction<settingsType>>,
  setLoading: Dispatch<SetStateAction<boolean>>,
): Promise<void> => {
  setLoading(true)

  try {
    const res = await axios.post("", {
      query: `
        query {
          getSettings {
            ${populateSettings}
          }
        }
      `,
    })

    if (res.data.errors) {
      console.error(`getSettings Error: ${res.data.errors[0].message}`)
    } else {
      setSettings(await checkAPIs(res.data.data.getSettings, true)) // Check all API's with the latest credentials
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
  formErr: settingsErrorType,
): Promise<void> => {
  setLoading(true)

  if (formHasErr(formErr)) {
    setLoading(false)
    console.error("updateSettings: Form has errors.")
    return
  }

  try {
    const res = await axios.post("", {
      variables: await checkAPIs(settings, true), // Check all API's with the latest credentials
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
          $import_blocked: Boolean
          $wanted_missing: Boolean
          $remove_failed: Boolean
          $remove_missing: Boolean
          $permissions_change: Boolean
          $tidy_directories: Boolean
          $import_blocked_loop: Int
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
            import_blocked: $import_blocked
            wanted_missing: $wanted_missing
            remove_failed: $remove_failed
            remove_missing: $remove_missing
            permissions_change: $permissions_change
            tidy_directories: $tidy_directories
            import_blocked_loop: $import_blocked_loop
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
          }) {
            ${populateSettings}
          }
        }
      `,
    })

    if (res.data.errors) {
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
