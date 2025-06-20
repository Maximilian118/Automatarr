import Settings, { settingsDocType } from "../../models/settings"
import logger from "../../logger"
import axios from "axios"
import { cleanUrl, requestSuccess } from "../../shared/utility"
import { getqBitCookieFromHeaders, qBitCookieExpired } from "../../shared/qBittorrentRequests"
import Data, { dataDocType } from "../../models/data"
import moment from "moment"
import { saveWithRetry } from "../../shared/database"
import { errCodeAndMsg } from "../../shared/requestError"
import { AuthRequest } from "../../middleware/auth"
import { activeAPIsArr } from "../../shared/activeAPIsArr"
import { initWebhookBody } from "../../types/webhookType"

const checkResolvers = {
  checkRadarr: async (
    args?: { URL?: string; KEY?: string },
    req?: AuthRequest,
  ): Promise<{ data: number; tokens: string[] }> => {
    if (req && !req.isAuth) {
      throw new Error("Unauthorised")
    }

    const tokens = req?.tokens || []
    let status = 500
    let { URL, KEY } = args || {}

    // If not passed explicitly, fetch from DB
    if (!URL || !KEY) {
      const settings = (await Settings.findOne()) as settingsDocType

      if (!settings) {
        logger.error("Radarr | No Settings found! Oh dear..")
        return { data: status, tokens }
      }

      if (!settings.radarr_active) {
        logger.info("Radarr | Inactive.")
        return { data: status, tokens }
      }

      if (!settings.radarr_URL || !settings.radarr_KEY) {
        logger.warn("Radarr | Missing credentials.")
        return { data: status, tokens }
      }

      URL = settings.radarr_URL
      KEY = settings.radarr_KEY
    }

    try {
      const res = await axios.get(cleanUrl(`${URL}/api?apikey=${KEY}`))
      status = res.status
      logger.success(`Radarr | OK!`)
    } catch (err) {
      logger.error(`checkRadarr: Error - ${errCodeAndMsg(err)}`)
    }

    return { data: status, tokens }
  },
  checkSonarr: async (
    args?: { URL?: string; KEY?: string },
    req?: AuthRequest,
  ): Promise<{ data: number; tokens: string[] }> => {
    if (req && !req.isAuth) {
      throw new Error("Unauthorised")
    }

    const tokens = req?.tokens || []
    let status = 500
    let { URL, KEY } = args || {}

    if (!URL || !KEY) {
      const settings = (await Settings.findOne()) as settingsDocType

      if (!settings) {
        logger.error("Sonarr | No Settings found! Oh dear..")
        return { data: status, tokens }
      }

      if (!settings.sonarr_active) {
        logger.info("Sonarr | Inactive.")
        return { data: status, tokens }
      }

      if (!settings.sonarr_URL || !settings.sonarr_KEY) {
        logger.warn("Sonarr | Missing credentials.")
        return { data: status, tokens }
      }

      URL = settings.sonarr_URL
      KEY = settings.sonarr_KEY
    }

    try {
      const res = await axios.get(cleanUrl(`${URL}/api?apikey=${KEY}`))
      status = res.status
      logger.success(`Sonarr | OK!`)
    } catch (err) {
      logger.error(`checkSonarr: Error - ${errCodeAndMsg(err)}`)
    }

    return { data: status, tokens }
  },
  checkLidarr: async (
    args?: { URL?: string; KEY?: string },
    req?: AuthRequest,
  ): Promise<{ data: number; tokens: string[] }> => {
    if (req && !req.isAuth) {
      throw new Error("Unauthorised")
    }

    const tokens = req?.tokens || []
    let status = 500
    let { URL, KEY } = args || {}

    if (!URL || !KEY) {
      const settings = (await Settings.findOne()) as settingsDocType

      if (!settings) {
        logger.error("Lidarr | No Settings found! Oh dear..")
        return { data: status, tokens }
      }

      if (!settings.lidarr_active) {
        logger.info("Lidarr | Inactive.")
        return { data: status, tokens }
      }

      if (!settings.lidarr_URL || !settings.lidarr_KEY) {
        logger.warn("Lidarr | Missing credentials.")
        return { data: status, tokens }
      }

      URL = settings.lidarr_URL
      KEY = settings.lidarr_KEY
    }

    try {
      const res = await axios.get(cleanUrl(`${URL}/api?apikey=${KEY}`))
      status = res.status
      logger.success(`Lidarr | OK!`)
    } catch (err) {
      logger.error(`checkLidarr: Error - ${errCodeAndMsg(err)}`)
    }

    return { data: status, tokens }
  },
  checkqBittorrent: async (
    args?: { URL?: string; USER?: string; PASS?: string },
    req?: AuthRequest,
  ): Promise<{ data: number; tokens: string[] }> => {
    if (req && !req.isAuth) {
      throw new Error("Unauthorised")
    }

    const tokens = req?.tokens || []
    let status = 500

    const settings = (await Settings.findOne()) as settingsDocType

    if (!settings) {
      logger.error("checkqBittorrent: No Settings object was found.")
      return { data: status, tokens }
    }

    const data = (await Data.findOne()) as dataDocType

    if (!data) {
      logger.error("checkqBittorrent: No Data object was found.")
      return { data: status, tokens }
    }

    const usingManualCreds = args?.URL && args?.USER && args?.PASS

    let URL = args?.URL || settings.qBittorrent_URL
    let USER = args?.USER || settings.qBittorrent_username
    let PASS = args?.PASS || settings.qBittorrent_password

    if (!URL || !USER || !PASS) {
      logger.warn("checkqBittorrent: Missing credentials.")
      return { data: status, tokens }
    }

    if (!usingManualCreds && !settings.qBittorrent_active) {
      logger.info("qBittorrent | Inactive")
      return { data: status, tokens }
    }

    if (!usingManualCreds && !(await qBitCookieExpired())) {
      logger.success("qBittorrent | Cookie OK!")
      return { data: 200, tokens }
    }

    try {
      const res = await axios.post(
        cleanUrl(`${URL}/api/${settings.qBittorrent_API_version}/auth/login`),
        new URLSearchParams({ username: USER, password: PASS }),
        {
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
        },
      )

      const { cookie, cookie_expiry } = await getqBitCookieFromHeaders(res, data)

      if (!cookie) {
        return { data: status, tokens } // getqBitCookieFromHeaders already logs
      }

      data.qBittorrent.cookie = cookie
      data.qBittorrent.cookie_expiry = cookie_expiry
      data.qBittorrent.updated_at = moment().format()
      data.updated_at = moment().format()

      await saveWithRetry(data, "checkqBittorrent")
      logger.success(`qBittorrent | Login OK!`)
      return { data: res.status, tokens }
    } catch (err) {
      logger.error(`qBittorrent | Error: ${errCodeAndMsg(err)}`)
      return { data: status, tokens }
    }
  },
  checkWebhooks: async (
    { webhookURL }: { webhookURL: string },
    req: AuthRequest,
  ): Promise<{ data: ("Radarr" | "Sonarr" | "Lidarr")[]; tokens: string[] }> => {
    if (req && !req.isAuth) {
      throw new Error("Unauthorised")
    }

    // Find settings object
    let settings = (await Settings.findOne()) as settingsDocType

    // Throw error if no object was found
    if (!settings) {
      logger.error("checkWebhooks: No settings found.")
      throw new Error("No settings found.")
    }

    // Only get data for API's that have been checked and are active
    const { activeAPIs } = await activeAPIsArr(settings._doc)

    let connectedAPIs: ("Radarr" | "Sonarr" | "Lidarr")[] = []

    // Send requests to add the webhook to each active API
    for (const API of activeAPIs) {
      try {
        const res = await axios.post(
          cleanUrl(`${API.data.URL}/api/${API.data.API_version}/notification`),
          initWebhookBody(API, webhookURL),
          {
            headers: {
              "Content-Type": "application/json",
              "X-Api-Key": API.data.KEY,
            },
          },
        )

        if (requestSuccess(res.status)) {
          connectedAPIs.push(API.name)
          logger.success(`Webhook | Connection for ${API.name} established!`)
        } else {
          logger.error(`Webhook | Unknown error. Status: ${res.status} - ${res.statusText}`)
        }
      } catch (err) {
        if (axios.isAxiosError(err) && err.response?.data) {
          const errors = err.response.data

          if (Array.isArray(errors) && errors.some((e) => e?.errorMessage === "Should be unique")) {
            // Treat as already connected
            connectedAPIs.push(API.name)
            logger.info(`Webhook | Connection for ${API.name} already exists.`)
          } else {
            logger.error(`Webhook | ${JSON.stringify(errors, null, 2)}`)
          }
        } else {
          logger.error(`Webhook |  Unexpected error: ${errCodeAndMsg(err)}`)
        }
      }
    }

    return {
      data: connectedAPIs,
      tokens: req.tokens,
    }
  },
}

export default checkResolvers
