import axios from "axios"
import { Dispatch, SetStateAction } from "react"
import { settingsType } from "../types"
import { populateSettings } from "./requestPopulation"
import { checkAPIs } from "../utility"

export const getSettings = async (
  setLoading: Dispatch<SetStateAction<boolean>>,
  setSettings: Dispatch<SetStateAction<settingsType>>,
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
): Promise<void> => {
  setLoading(true)

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
          $import_blocked_loop: Int
          $wanted_missing_loop: Int
          $qBittorrent_URL: String
          $qBittorrent_username: String
          $qBittorrent_password: String
          $qBittorrent_active: Boolean
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
            import_blocked_loop: $import_blocked_loop
            wanted_missing_loop: $wanted_missing_loop
            qBittorrent_URL: $qBittorrent_URL
            qBittorrent_username: $qBittorrent_username
            qBittorrent_password: $qBittorrent_password
            qBittorrent_active: $qBittorrent_active
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
