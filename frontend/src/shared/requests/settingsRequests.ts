import axios from "axios"
import { Dispatch, SetStateAction } from "react"
import { settingsType } from "../types"
import { populateSettings } from "./requestPopulation"

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
      setSettings(res.data.data.getSettings)
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
      variables: settings,
      query: `
        mutation UpdateSettings( 
          $_id: ID!
          $radarr_URL: String
          $radarr_KEY: String
          $sonarr_URL: String
          $sonarr_KEY: String
          $lidarr_URL: String
          $lidarr_KEY: String
          $import_blocked: Boolean
          $wanted_missing: Boolean
          $import_blocked_loop: Int
          $wanted_missing_loop: Int
          $qBittorrent_URL: String ) {
          updateSettings(settingsInput: {  
            _id: $_id
            radarr_URL: $radarr_URL
            radarr_KEY: $radarr_KEY
            sonarr_URL: $sonarr_URL
            sonarr_KEY: $sonarr_KEY
            lidarr_URL: $lidarr_URL
            lidarr_KEY: $lidarr_KEY
            import_blocked: $import_blocked
            wanted_missing: $wanted_missing
            import_blocked_loop: $import_blocked_loop
            wanted_missing_loop: $wanted_missing_loop
            qBittorrent_URL: $qBittorrent_URL
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
