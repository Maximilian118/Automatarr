import axios from "axios"
import { settingsType } from "../../types/settingsType"

// Checks if API connection is working. If settings not passed, check with params in db.
export const checkRadarr = async (settings?: settingsType): Promise<boolean> => {
  // prettier-ignore
  try {
    const res = await axios.post("", settings ? 
      {
        variables: {
          URL: settings?.radarr_URL,
          KEY: settings?.radarr_KEY,
        },
        query: `
          query CheckNewRadarr( $URL: String!, $KEY: String! ) {
            checkNewRadarr( URL: $URL, KEY: $KEY )
          }
        `,
      } : {
        query: `
          query {
            checkRadarr
          }
        `,
      }
    )
    // Retrieve name of request for logging
    const APIName = Object.keys(res.data.data)[0]

    if (res.data.errors) {
      console.error(`${APIName} Error: ${res.data.errors[0].message}`)
      return false
    } else {
      if (Number(res.data.data[APIName]) === 200) {
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
export const checkSonarr = async (settings?: settingsType): Promise<boolean> => {
  // prettier-ignore
  try {
    const res = await axios.post("", settings ? 
      {
        variables: {
          URL: settings?.sonarr_URL,
          KEY: settings?.sonarr_KEY,
        },
        query: `
          query CheckNewSonarr( $URL: String!, $KEY: String! ) {
            checkNewSonarr( URL: $URL, KEY: $KEY )
          }
        `,
      } : {
        query: `
          query {
            checkSonarr
          }
        `,
      }
    )
    // Retrieve name of request for logging
    const APIName = Object.keys(res.data.data)[0]

    if (res.data.errors) {
      console.error(`${APIName} Error: ${res.data.errors[0].message}`)
      return false
    } else {
      if (Number(res.data.data[APIName]) === 200) {
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
export const checkLidarr = async (settings?: settingsType): Promise<boolean> => {
  // prettier-ignore
  try { 
    const res = await axios.post("", settings ?
      {
        variables: {
          URL: settings?.lidarr_URL,
          KEY: settings?.lidarr_KEY,
        },
        query: `
          query CheckNewLidarr( $URL: String!, $KEY: String! ) {
            checkNewLidarr( URL: $URL, KEY: $KEY )
          }
        `,
      } : {
        query: `
          query {
            checkLidarr
          }
        `,
      }
    )
    // Retrieve name of request for logging
    const APIName = Object.keys(res.data.data)[0]
    
    if (res.data.errors) {
      console.error(`${APIName} Error: ${res.data.errors[0].message}`)
      return false
    } else {
      if (Number(res.data.data[APIName]) === 200) {
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
export const checkqBittorrent = async (settings?: settingsType): Promise<boolean> => {
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
          query CheckNewqBittorrent( $URL: String!, $USER: String!, $PASS: String! ) {
            checkNewqBittorrent(URL: $URL, USER: $USER, PASS: $PASS)
          }
        `,
      } : {
        query: `
          query {
            checkqBittorrent
          }
        `,
      }
    )
    // Retrieve name of request for logging
    const APIName = Object.keys(res.data.data)[0]
    
    if (res.data.errors) {
      console.error(`${APIName} Error: ${res.data.errors[0].message}`)
      return false
    } else {
      if (Number(res.data.data[APIName]) === 200) {
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
