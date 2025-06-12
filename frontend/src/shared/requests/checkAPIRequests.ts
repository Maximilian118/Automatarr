import axios from "axios"
import { settingsType } from "../../types/settingsType"
import { Dispatch, SetStateAction } from "react"
import { UserType } from "../../types/userType"
import { NavigateFunction } from "react-router-dom"
import { authCheck, headers } from "./requestUtility"

// Checks if API connection is working.
// If settings not passed, check with params in db.
export const checkRadarr = async (
  user: UserType,
  setUser: Dispatch<SetStateAction<UserType>>,
  navigate: NavigateFunction,
  settings?: settingsType,
): Promise<boolean> => {
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
      if (Number(res.data.data[APIName].data) === 200) {
        console.log(`${APIName}: OK!`)
        return true
      } else {
        console.log(`${APIName}: http status ${res.data.data[APIName]}`)
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
      if (Number(res.data.data[APIName].data) === 200) {
        console.log(`${APIName}: OK!`)
        return true
      } else {
        console.log(`${APIName}: http status ${res.data.data[APIName]}`)
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
      if (Number(res.data.data[APIName].data) === 200) {
        console.log(`${APIName}: OK!`)
        return true
      } else {
        console.log(`${APIName}: http status ${res.data.data[APIName]}`)
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
      if (Number(res.data.data[APIName].data) === 200) {
        console.log(`${APIName}: OK!`)
        return true
      } else {
        console.log(`${APIName}: http status ${res.data.data[APIName]}`)
        return false
      }
    }
  } catch (err) {
    console.error(`Lidarr API Check Error: ${err}`)
    return false
  }
}
