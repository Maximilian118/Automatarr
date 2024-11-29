import { Dispatch, SetStateAction } from "react"
import { settingsErrorType, settingsType } from "../types/settingsType"
import {
  checkLidarr,
  checkqBittorrent,
  checkRadarr,
  checkSonarr,
} from "./requests/checkAPIRequests"

// Check the status of each API
export const checkAPIs = async (
  settings: settingsType,
  newCredentials?: true,
): Promise<settingsType> => {
  const [radarr_active, sonarr_active, lidarr_active, qBittorrent_active] = await Promise.all([
    checkRadarr(newCredentials && settings),
    checkSonarr(newCredentials && settings),
    checkLidarr(newCredentials && settings),
    checkqBittorrent(newCredentials && settings),
  ])

  return {
    ...settings,
    radarr_active,
    sonarr_active,
    lidarr_active,
    qBittorrent_active,
  }
}

// Check if a form error object has any populated strings. I.E if there are some errors return true.
export const formHasErr = (obj: settingsErrorType) => Object.values(obj).some((value) => value.trim() !== "")

// Return chown string
export const createChownString = (
  user: string | null, 
  group: string | null, 
  settings: settingsType, 
  setSettings: Dispatch<SetStateAction<settingsType>>
) => {
  let chown = `${user ? user : ""}:${group ? group : ""}`

  if (!user || !group) {
    chown = ""
  }
  
  if (settings.permissions_change_chown !== chown) {
    setSettings(prevSettings => {
      return {
        ...prevSettings,
        permissions_change_chown: chown,
      }
    })
  }
}
