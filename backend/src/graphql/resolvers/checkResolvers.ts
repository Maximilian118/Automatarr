import Settings from "../../models/settings"
import logger from "../../logger"
import axios from "axios"

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
        `${settings.radarr_URL}/system/status?apikey=${settings.radarr_KEY}`,
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
        `${settings.sonarr_URL}/system/status?apikey=${settings.sonarr_KEY}`,
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
        `${settings.lidarr_URL}/system/status?apikey=${settings.lidarr_URL}`,
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
}

export default checkResolvers
