import axios from "axios"
import { settingsType } from "../../types/settingsType"
import { Dispatch, SetStateAction } from "react"
import { UserType } from "../../types/userType"
import { NavigateFunction } from "react-router-dom"
import { authCheck, handleResponseTokens, headers } from "./requestUtility"

// Checks if API connection is working.
// If settings not passed, check with params in db.
export const checkRadarr = async (
  user: UserType,
  setUser: Dispatch<SetStateAction<UserType>>,
  navigate: NavigateFunction,
  settings?: settingsType,
): Promise<boolean> => {
  if (settings && (!settings.radarr_URL || !settings.radarr_KEY)) {
    console.warn("checkRadarr: Missing URL or KEY")
    return false
  }

  // prettier-ignore
  try {
    const res = await axios.post("", settings ? 
      {
        variables: {
          URL: settings?.radarr_URL,
          KEY: settings?.radarr_KEY,
        },
        query: `
          query CheckRadarr( $URL: String!, $KEY: String! ) {
            checkRadarr( URL: $URL, KEY: $KEY ) {
              data
              tokens
            }
          }
        `,
      } : {
        query: `
          query {
            checkRadarr {
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
    console.error(`Radarr API Check Error: ${err}`)
    return false
  }
}
// Checks if API connection is working. If settings not passed, check with params in db.
export const checkSonarr = async (
  user: UserType,
  setUser: Dispatch<SetStateAction<UserType>>,
  navigate: NavigateFunction,
  settings?: settingsType,
): Promise<boolean> => {
  if (settings && (!settings.sonarr_URL || !settings.sonarr_KEY)) {
    console.warn("checkSonarr: Missing URL or KEY")
    return false
  }

  // prettier-ignore
  try {
    const res = await axios.post("", settings ? 
      {
        variables: {
          URL: settings?.sonarr_URL,
          KEY: settings?.sonarr_KEY,
        },
        query: `
          query CheckSonarr( $URL: String!, $KEY: String! ) {
            checkSonarr( URL: $URL, KEY: $KEY ) {
              data
              tokens
            }
          }
        `,
      } : {
        query: `
          query {
            checkSonarr {
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
    console.error(`Sonarr API Check Error: ${err}`)
    return false
  }
}
// Checks if API connection is working. If settings not passed, check with params in db.
export const checkLidarr = async (
  user: UserType,
  setUser: Dispatch<SetStateAction<UserType>>,
  navigate: NavigateFunction,
  settings?: settingsType,
): Promise<boolean> => {
  if (settings && (!settings.lidarr_URL || !settings.lidarr_KEY)) {
    console.warn("checkLidarr: Missing URL or KEY")
    return false
  }

  // prettier-ignore
  try { 
    const res = await axios.post("", settings ?
      {
        variables: {
          URL: settings?.lidarr_URL,
          KEY: settings?.lidarr_KEY,
        },
        query: `
          query CheckLidarr( $URL: String!, $KEY: String! ) {
            checkLidarr( URL: $URL, KEY: $KEY ) {
              data
              tokens
            }
          }
        `,
      } : {
        query: `
          query {
            checkLidarr {
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
