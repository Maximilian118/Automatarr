import { Dispatch, SetStateAction } from "react"
import axios from "axios"
import { validAPIType } from "../types"

const checkAPIResHandler = (
  setValidAPI: Dispatch<SetStateAction<validAPIType>>,
  name: "radarr" | "sonarr" | "lidarr",
  outcome: boolean,
) => {
  setValidAPI((prevAPIs) => {
    return {
      ...prevAPIs,
      [name]: outcome,
    }
  })
}

export const checkRadarr = async (
  setValidAPI: Dispatch<SetStateAction<validAPIType>>,
): Promise<void> => {
  try {
    const res = await axios.post("", {
      query: `
        query {
          checkRadarr
        }
      `,
    })

    if (res.data.errors) {
      console.error(`checkRadarr Error: ${res.data.errors[0].message}`)
      checkAPIResHandler(setValidAPI, "radarr", false)
    } else {
      if (Number(res.data.data.checkRadarr) === 200) {
        checkAPIResHandler(setValidAPI, "radarr", true)
        console.log(`checkRadarr: OK!`)
      } else {
        checkAPIResHandler(setValidAPI, "radarr", false)
        console.log(`checkRadarr status: ${res.data.data.checkRadarr}`)
      }
    }
  } catch (err) {
    console.error(`checkRadarr Error: ${err}`)
    checkAPIResHandler(setValidAPI, "radarr", false)
  }
}

export const checkSonarr = async (
  setValidAPI: Dispatch<SetStateAction<validAPIType>>,
): Promise<void> => {
  try {
    const res = await axios.post("", {
      query: `
        query {
          checkSonarr
        }
      `,
    })

    if (res.data.errors) {
      console.error(`checkSonarr Error: ${res.data.errors[0].message}`)
      checkAPIResHandler(setValidAPI, "sonarr", false)
    } else {
      if (Number(res.data.data.checkSonarr) === 200) {
        checkAPIResHandler(setValidAPI, "sonarr", true)
        console.log(`checkSonarr: OK!`)
      } else {
        checkAPIResHandler(setValidAPI, "sonarr", false)
        console.log(`checkSonarr status: ${res.data.data.checkSonarr}`)
      }
    }
  } catch (err) {
    console.error(`checkSonarr Error: ${err}`)
    checkAPIResHandler(setValidAPI, "sonarr", false)
  }
}

export const checkLidarr = async (
  setValidAPI: Dispatch<SetStateAction<validAPIType>>,
): Promise<void> => {
  try {
    const res = await axios.post("", {
      query: `
        query {
          checkLidarr
        }
      `,
    })

    if (res.data.errors) {
      console.error(`checkLidarr Error: ${res.data.errors[0].message}`)
      checkAPIResHandler(setValidAPI, "lidarr", false)
    } else {
      if (Number(res.data.data.checkLidarr) === 200) {
        checkAPIResHandler(setValidAPI, "lidarr", true)
        console.log(`checkLidarr: OK!`)
      } else {
        checkAPIResHandler(setValidAPI, "lidarr", false)
        console.log(`checkLidarr status: ${res.data.data.checkLidarr}`)
      }
    }
  } catch (err) {
    console.error(`checkLidarr Error: ${err}`)
    checkAPIResHandler(setValidAPI, "lidarr", false)
  }
}
