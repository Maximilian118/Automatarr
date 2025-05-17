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

// Pass a string literal and output respects new lines
export const multilineText = (string: string, className?: string) => {
  const lines = string.trim().split('\n')

  const paragraphs = lines.map((line, index) => {
    const trimmed = line.trim()

    if (!trimmed) {
      // Render vertical space between paragraphs
      return <div key={index} style={{ height: '1em' }} />
    }

    return (
      <p key={index}>
        {trimmed}
      </p>
    )
  })

  return <div className={className}>{paragraphs}</div>
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

// Output the last two dirs for the given path
export const shortPath = (path: string, depth: number = 2, ellipsis: boolean = true): string => {
  const parts = path.split('/').filter(Boolean) // Split and clean up the path
  
  // If the number of parts is less than or equal to depth, return the full path
  if (parts.length <= depth) {
    return `/${parts.join('/')}`
  }

  // If there are more parts than the depth, shorten the path
  const lastDirs = parts.slice(-depth).join('/') // Get the last `depth` directories
  return `${ellipsis ? ".../" : ""}${lastDirs}` // Show "..." for the parent directories, then the last `depth` directories
}