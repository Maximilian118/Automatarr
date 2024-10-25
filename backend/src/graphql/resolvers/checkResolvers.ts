import Settings from "../../models/settings"
import logger from "../../logger"
import axios from "axios"
import { cleanUrl } from "../../shared/utility"

// Check for skip API check cases
const CheckAPISkip = (name: string, URL: string, KEY: string): boolean => {
  if (!URL && !KEY) {
    logger.warn(`${name} | No Settings. Skipping...`)
    return true
  }

  if (!URL) {
    logger.warn(`${name} | No URL set. Skipping...`)
    return true
  } else if (!/^(http:\/\/)?(localhost|(\d{1,3}\.){3}\d{1,3}):\d{1,5}(\/)?$/.test(URL)) {
    logger.warn(`${name} | URL invalid. Skipping...`)
    return true
  }

  if (!KEY) {
    logger.warn(`${name} | No KEY set. Skipping...`)
    return true
  } else if (!/^[a-fA-F0-9]{32}$/.test(KEY)) {
    logger.warn(`${name} | KEY invalid. Skipping...`)
    return true
  }

  return false
}

type checkNewType = {
  URL: string
  KEY: string
}

const checkResolvers = {
  checkRadarr: async (): Promise<number> => {
    let status = 500

    const settings = await Settings.findOne()

    if (!settings) {
      logger.error("checkRadarr: No Settings object was found.")
      return 500
    }

    if (CheckAPISkip("Radarr", settings.radarr_URL, settings.radarr_KEY)) {
      return 500
    }

    try {
      const res = await axios.get(
        cleanUrl(`${settings.radarr_URL}/api?apikey=${settings.radarr_KEY}`),
      )

      status = res.status
      logger.info(`Radarr | OK!`)
    } catch (err) {
      if (axios.isAxiosError(err)) {
        logger.error(`checkRadarr: ${err}`)
      } else {
        logger.error(`checkRadarr: ${err}`)
      }
    }

    return status
  },
  checkSonarr: async (): Promise<number> => {
    let status = 500

    const settings = await Settings.findOne()

    if (!settings) {
      logger.error("checkSonarr: No Settings object was found.")
      return 500
    }

    if (CheckAPISkip("Sonarr", settings.sonarr_URL, settings.sonarr_KEY)) {
      return 500
    }

    try {
      const res = await axios.get(
        cleanUrl(`${settings.sonarr_URL}/api?apikey=${settings.sonarr_KEY}`),
      )

      status = res.status
      logger.info(`Sonarr | OK!`)
    } catch (err) {
      if (axios.isAxiosError(err)) {
        logger.error(`checkSonarr: ${err}`)
      } else {
        logger.error(`checkSonarr: ${err}`)
      }
    }

    return status
  },
  checkLidarr: async (): Promise<number> => {
    let status = 500

    const settings = await Settings.findOne()

    if (!settings) {
      logger.error("checkLidarr: No Settings object was found.")
      return 500
    }

    if (CheckAPISkip("Lidarr", settings.lidarr_URL, settings.lidarr_KEY)) {
      return 500
    }

    try {
      const res = await axios.get(
        cleanUrl(`${settings.lidarr_URL}/api?apikey=${settings.lidarr_KEY}`),
      )

      status = res.status
      logger.info(`Lidarr | OK!`)
    } catch (err) {
      if (axios.isAxiosError(err)) {
        logger.error(`checkLidarr: ${err}`)
      } else {
        logger.error(`checkLidarr: ${err}`)
      }
    }

    return status
  },
  checkNewRadarr: async ({ URL, KEY }: checkNewType): Promise<number> => {
    let status = 500

    if (CheckAPISkip("Radarr", URL, KEY)) {
      return 500
    }

    try {
      const res = await axios.get(cleanUrl(`${URL}/api?apikey=${KEY}`))

      status = res.status
      logger.info(`Radarr | OK!`)
    } catch (err) {
      if (axios.isAxiosError(err)) {
        logger.error(`checkNewRadarr: ${err}`)
      } else {
        logger.error(`checkNewRadarr: ${err}`)
      }
    }

    return status
  },
  checkNewSonarr: async ({ URL, KEY }: checkNewType): Promise<number> => {
    let status = 500

    if (CheckAPISkip("Sonarr", URL, KEY)) {
      return 500
    }

    try {
      const res = await axios.get(cleanUrl(`${URL}/api?apikey=${KEY}`))

      status = res.status
      logger.info(`Sonarr | OK!`)
    } catch (err) {
      if (axios.isAxiosError(err)) {
        logger.error(`checkNewSonarr: ${err}`)
      } else {
        logger.error(`checkNewSonarr: ${err}`)
      }
    }

    return status
  },
  checkNewLidarr: async ({ URL, KEY }: checkNewType): Promise<number> => {
    let status = 500

    if (CheckAPISkip("Lidarr", URL, KEY)) {
      return 500
    }

    try {
      const res = await axios.get(cleanUrl(`${URL}/api?apikey=${KEY}`))

      status = res.status
      logger.info(`Lidarr | OK!`)
    } catch (err) {
      if (axios.isAxiosError(err)) {
        logger.error(`checkNewLidarr: ${err}`)
      } else {
        logger.error(`checkNewLidarr: ${err}`)
      }
    }

    return status
  },
}

export default checkResolvers
