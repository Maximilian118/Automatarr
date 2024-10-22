import { settingsType } from "../../models/settings"
import logger from "../../logger"
import axios from "axios"

const checkResolvers = {
  checkRadarr: async (settings: settingsType): Promise<number> => {
    let status = 500

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
  checkSonarr: async (settings: settingsType): Promise<number> => {
    let status = 500

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
  checkLidarr: async (settings: settingsType): Promise<number> => {
    let status = 500

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
