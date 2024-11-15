import Settings from "../../models/settings"
import logger from "../../logger"
import axios from "axios"
import { cleanUrl } from "../../shared/utility"
import { checkStarr, checkURL } from "../../shared/validation"

interface baseCheck {
  URL: string
}

interface checkNew extends baseCheck {
  KEY: string
}

interface checkNewWithCreds extends baseCheck {
  USER: string
  PASS: string
}

const checkResolvers = {
  checkRadarr: async (): Promise<number> => {
    let status = 500

    const settings = await Settings.findOne()

    if (!settings) {
      logger.error("checkRadarr: No Settings object was found.")
      return 500
    }

    if (checkStarr("Radarr", settings.radarr_URL, settings.radarr_KEY)) {
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

    if (checkStarr("Sonarr", settings.sonarr_URL, settings.sonarr_KEY)) {
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

    if (checkStarr("Lidarr", settings.lidarr_URL, settings.lidarr_KEY)) {
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
  checkqBittorrent: async (): Promise<number> => {
    let status = 500

    const settings = await Settings.findOne()

    if (!settings) {
      logger.error("checkqBittorrent: No Settings object was found.")
      return 500
    }

    if (checkURL("qBittorrent", settings.qBittorrent_URL)) {
      return 500
    }

    try {
      const res = await axios.post(
        cleanUrl(
          `${settings.qBittorrent_URL}/api/${settings.qBittorrent_API_version}/auth/login?username=${settings.qBittorrent_username}&password=${settings.qBittorrent_password}`,
        ),
      )

      status = res.status
      logger.info(`qBittorrent | OK!`)
    } catch (err) {
      if (axios.isAxiosError(err)) {
        logger.error(`checkqBittorrent: ${err}`)
      } else {
        logger.error(`checkqBittorrent: ${err}`)
      }
    }

    return status
  },
  checkNewRadarr: async ({ URL, KEY }: checkNew): Promise<number> => {
    let status = 500

    if (checkStarr("Radarr", URL, KEY)) {
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
  checkNewSonarr: async ({ URL, KEY }: checkNew): Promise<number> => {
    let status = 500

    if (checkStarr("Sonarr", URL, KEY)) {
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
  checkNewLidarr: async ({ URL, KEY }: checkNew): Promise<number> => {
    let status = 500

    if (checkStarr("Lidarr", URL, KEY)) {
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
  checkNewqBittorrent: async ({ URL, USER, PASS }: checkNewWithCreds): Promise<number> => {
    let status = 500

    if (checkURL("qBittorrent", URL)) {
      return 500
    }

    const settings = await Settings.findOne()

    if (!settings) {
      logger.error("checkNewqBittorrent: No Settings object was found.")
      return 500
    }

    try {
      const res = await axios.post(
        cleanUrl(
          `${URL}/api/${settings.qBittorrent_API_version}/auth/login?username=${USER}&password=${PASS}`,
        ),
      )

      status = res.status
      logger.info(`qBittorrent | OK!`)
    } catch (err) {
      if (axios.isAxiosError(err)) {
        logger.error(`checkNewqBittorrent: ${err}`)
      } else {
        logger.error(`checkNewqBittorrent: ${err}`)
      }
    }

    return status
  },
}

export default checkResolvers
