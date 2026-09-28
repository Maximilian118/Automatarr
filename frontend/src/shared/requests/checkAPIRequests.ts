import axios from "axios"
import { settingsType } from "../../types/settingsType"
import { Dispatch, SetStateAction } from "react"
import { UserType } from "../../types/userType"
import { NavigateFunction } from "react-router-dom"
import { authCheck, handleResponseTokens, headers } from "./requestUtility"

// Connections that are checked with a URL and an API key/token
type URLKeyAPI = "Radarr" | "Sonarr" | "Lidarr" | "Plex"

// Checks if a URL + KEY API connection is working.
// If settings not passed, check with params in db.
const checkURLKeyAPI = async (
  apiName: URLKeyAPI,
  user: UserType,
  setUser: Dispatch<SetStateAction<UserType>>,
  navigate: NavigateFunction,
  settings?: settingsType,
): Promise<boolean> => {
  const prefix = apiName.toLowerCase()
  const URL = settings?.[`${prefix}_URL` as keyof settingsType] as string | undefined
  const KEY = settings?.[`${prefix}_KEY` as keyof settingsType] as string | undefined
  const queryName = `check${apiName}`

  if (settings && (!URL || !KEY)) {
    console.warn(`${queryName}: Missing URL or KEY`)
    return false
  }

  // prettier-ignore
  try {
    const res = await axios.post("", settings ?
      {
        variables: { URL, KEY },
        query: `
          query Check${apiName}( $URL: String!, $KEY: String! ) {
            ${queryName}( URL: $URL, KEY: $KEY ) {
              data
              tokens
            }
          }
        `,
      } : {
        query: `
          query {
            ${queryName} {
              data
              tokens
            }
          }
        `,
      }, { headers: headers(user.token) }
    )

    if (res.data.errors) {
      authCheck(res.data.errors, setUser, navigate)
      console.error(`${queryName} Error: ${res.data.errors[0].message}`)
      return false
    }

    handleResponseTokens(res.data.data[queryName], setUser)

    if (Number(res.data.data[queryName].data) === 200) {
      console.log(`${queryName}: OK!`)
      return true
    }

    console.log(`${queryName}: Status ${res.data.data[queryName].data}`)
    return false
  } catch (err) {
    console.error(`${apiName} API Check Error: ${err}`)
    return false
  }
}

// Checks if the Radarr connection is working. If settings not passed, check with params in db.
export const checkRadarr = (
  user: UserType,
  setUser: Dispatch<SetStateAction<UserType>>,
  navigate: NavigateFunction,
  settings?: settingsType,
): Promise<boolean> => checkURLKeyAPI("Radarr", user, setUser, navigate, settings)

// Checks if the Sonarr connection is working. If settings not passed, check with params in db.
export const checkSonarr = (
  user: UserType,
  setUser: Dispatch<SetStateAction<UserType>>,
  navigate: NavigateFunction,
  settings?: settingsType,
): Promise<boolean> => checkURLKeyAPI("Sonarr", user, setUser, navigate, settings)

// Checks if the Lidarr connection is working. If settings not passed, check with params in db.
export const checkLidarr = (
  user: UserType,
  setUser: Dispatch<SetStateAction<UserType>>,
  navigate: NavigateFunction,
  settings?: settingsType,
): Promise<boolean> => checkURLKeyAPI("Lidarr", user, setUser, navigate, settings)

// Checks if the Plex connection is working. If settings not passed, check with params in db.
export const checkPlex = (
  user: UserType,
  setUser: Dispatch<SetStateAction<UserType>>,
  navigate: NavigateFunction,
  settings?: settingsType,
): Promise<boolean> => checkURLKeyAPI("Plex", user, setUser, navigate, settings)

// Checks if API connection is working. If settings not passed, check with params in db.
export const checkqBittorrent = async (
  user: UserType,
  setUser: Dispatch<SetStateAction<UserType>>,
  navigate: NavigateFunction,
  settings?: settingsType,
): Promise<boolean> => {
  if (
    settings &&
    (!settings.qBittorrent_URL || !settings.qBittorrent_username || !settings.qBittorrent_password)
  ) {
    return false
  }
  // prettier-ignore
  try { 
    const res = await axios.post("", settings ?
      {
        variables: {
          URL: settings?.qBittorrent_URL,
          USER: settings?.qBittorrent_username,
          PASS: settings?.qBittorrent_password,
        },
        query: `
          query CheckqBittorrent( $URL: String!, $USER: String!, $PASS: String! ) {
            checkqBittorrent(URL: $URL, USER: $USER, PASS: $PASS) {
              data
              tokens
            }
          }
        `,
      } : {
        query: `
          query {
            checkqBittorrent {
              data
              tokens
            }
          }
        `,
      }, { headers: headers(user.token) }
    )
    // Retrieve name of request for logging
    const APIName = Object.keys(res.data.data)[0]
    
    if (res.data.errors) {
      authCheck(res.data.errors, setUser, navigate)
      console.error(`${APIName} Error: ${res.data.errors[0].message}`)
      return false
    } else {
      handleResponseTokens(res.data.data[APIName], setUser)

      if (Number(res.data.data[APIName].data) === 200) {
        console.log(`${APIName}: OK!`)
        return true
      } else {
        console.log(`${APIName}: Status ${res.data.data[APIName].data}`)
        return false
      }
    }
  } catch (err) {
    console.error(`Lidarr API Check Error: ${err}`)
    return false
  }
}

// send requests to active API's and ensure each one has a connection to the webhook URL.
export const checkWebhooks = async (
  user: UserType,
  setUser: Dispatch<SetStateAction<UserType>>,
  setLoading: Dispatch<SetStateAction<boolean>>,
  navigate: NavigateFunction,
  webhookURL: string,
): Promise<("Radarr" | "Sonarr" | "Lidarr")[]> => {
  if (webhookURL.includes("Invalid")) {
    console.error(`checkWebhooks: Invalid Webhook URL.`)
    return []
  }

  setLoading(true)

  try {
    const res = await axios.post(
      "",
      {
        variables: {
          webhookURL,
        },
        query: `
          query CheckWebhooks($webhookURL: String!) {
            checkWebhooks(webhookURL: $webhookURL) {
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
      console.error(`checkWebhooks Error: ${res.data.errors[0].message}`)
    } else {
      return res.data.data.checkWebhooks.data
    }
  } catch (err) {
    console.error(`checkWebhooks Error: ${err}`)
  } finally {
    setLoading(false)
  }

  return []
}
