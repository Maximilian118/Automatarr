import { Dispatch, SetStateAction } from "react"
import { settingsErrorType, settingsType } from "../types/settingsType"
import {
  checkLidarr,
  checkqBittorrent,
  checkRadarr,
  checkSonarr,
} from "./requests/checkAPIRequests"
import { nivoData } from "../types/dataType"
import moment from "moment"

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

// Transform all the timestamps to a specific format
export const transformNivoData = (data: nivoData[]): nivoData[] => {
  return data.map((da) => {
    let lastProcessedDay: string | null = null // Track the most recent day we've seen
    const today = moment().format("YYYY-MM-DD") // Today's date

    return {
      ...da,
      data: da.data.map((d) => {
        const currentDay = moment(d.x).format("YYYY-MM-DD") // Extract the day (e.g., "2024-12-06")

        let formattedTime
        if (currentDay === today) {
          // If it's today, always use "ha"
          formattedTime = moment(d.x).format("ha")
        } else if (currentDay !== lastProcessedDay) {
          // If it's a new previous day, use "ha Do MMM"
          formattedTime = moment(d.x).format("ha Do MMM")
          lastProcessedDay = currentDay // Update the last processed day
        } else {
          // For subsequent timestamps on the same previous day, use "ha"
          formattedTime = moment(d.x).format("ha")
        }

        return {
          ...d,
          x: formattedTime,
        }
      }),
    }
  })
}
