import Settings from "../../models/settings"
import logger from "../../logger"
import axios from "axios"
import { cleanUrl, errCodeAndMsg } from "../../shared/utility"
import { checkStarr, checkURL } from "../../shared/validation"
import { getqBitCookieFromHeaders, qBitCookieExpired } from "../../shared/qBittorrentRequests"

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

    if (!settings.sonarr_active) {
      logger.info("Radarr | Inactive")
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
      logger.success(`Radarr | OK!`)
    } catch (err) {
      logger.error(`checkRadarr: Error: ${errCodeAndMsg(err)}`)
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

    if (!settings.sonarr_active) {
      logger.info("Sonarr | Inactive")
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
      logger.success(`Sonarr | OK!`)
    } catch (err) {
      logger.error(`checkSonarr: Error: ${errCodeAndMsg(err)}`)
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

    if (!settings.lidarr_active) {
      logger.info("Lidarr | Inactive")
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
      logger.success(`Lidarr | OK!`)
    } catch (err) {
      logger.error(`checkLidarr: Error: ${errCodeAndMsg(err)}`)
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

    if (!settings.qBittorrent_active) {
      logger.info("qBittorrent | Inactive")
      return 500
    }

    if (checkURL("qBittorrent", settings.qBittorrent_URL)) {
      return 500
    }

    if (!(await qBitCookieExpired())) {
      logger.success("qBittorrent | Cookie OK!")
      return 200
    }

    try {
      const res = await axios.post(
        cleanUrl(`${settings.qBittorrent_URL}/api/${settings.qBittorrent_API_version}/auth/login`),
        new URLSearchParams({
          username: settings.qBittorrent_username,
          password: settings.qBittorrent_password,
        }),
        {
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
        },
      )

      const cookie = await getqBitCookieFromHeaders(res)

      if (!cookie) {
        // getqBitCookieFromHeaders will handle err logs
        return 500
      }

      logger.success("qBittorrent | Login OK!")
      return res.status
    } catch (err) {
      logger.error(`qBittorrent | Error: ${errCodeAndMsg(err)}`)
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
      logger.success(`Radarr | OK!`)
    } catch (err) {
      logger.error(`checkRadarr: Error: ${errCodeAndMsg(err)}`)
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
      logger.success(`Sonarr | OK!`)
    } catch (err) {
      logger.error(`checkSonarr: Error: ${errCodeAndMsg(err)}`)
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
      logger.success(`Lidarr | OK!`)
    } catch (err) {
      logger.error(`checkLidarr: Error: ${errCodeAndMsg(err)}`)
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
        cleanUrl(`${URL}/api/${settings.qBittorrent_API_version}/auth/login`),
        new URLSearchParams({
          username: USER,
          password: PASS,
        }),
        {
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
        },
      )

      const cookie = await getqBitCookieFromHeaders(res)

      if (!cookie) {
        // getqBitCookieFromHeaders will handle err logs
        return 500
      }

      logger.success("qBittorrent | Login OK!")
      return res.status
    } catch (err) {
      logger.error(`qBittorrent | Error: ${errCodeAndMsg(err)}`)
    }

    return status
  },
}

export default checkResolvers
