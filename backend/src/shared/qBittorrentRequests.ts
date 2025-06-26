import axios, { AxiosResponse } from "axios"
import Data, { dataType, qBittorrent } from "../models/data"
import Settings, { settingsDocType, settingsType } from "../models/settings"
import { checkTimePassed, cleanUrl, requestSuccess } from "./utility"
import logger from "../logger"
import { qBittorrentPreferences, Torrent, TorrentCategory } from "../types/qBittorrentTypes"
import moment from "moment"
import { saveWithRetry } from "./database"
import { axiosErrorMessage } from "./requestError"

// Retreive qBittorrent cookie from check request headers
export const getqBitCookieFromHeaders = async (
  res: AxiosResponse<any, any>,
  data: dataType,
): Promise<{
  cookie: string
  cookie_expiry: string
}> => {
  const response = {
    cookie: "",
    cookie_expiry: "",
  }

  const cookiesInHeader = res.headers["set-cookie"]

  if (!cookiesInHeader || cookiesInHeader.length === 0) {
    logger.error(`qBittorrent | Could not find cookie in response headers.`)
    return response
  }

  const regexedCookie = cookiesInHeader[0].match(/SID=[^;]+/)

  if (!regexedCookie) {
    logger.error(`qBittorrent | Could not find cookie in set-cookie string.`)
    return response
  }

  response.cookie = regexedCookie[0]

  if (!data.qBittorrent.preferences) {
    logger.error(`qBittorrent | No preferences have been passed.`)
    return response
  }

  response.cookie_expiry = moment()
    .add(data.qBittorrent.preferences.web_ui_session_timeout || 3600, "seconds")
    .format()

  return response
}

// Check if cookie has expired
export const qBitCookieExpired = async (passedData?: dataType): Promise<boolean> => {
  // Retrieve the data object from the db
  const data = passedData ? passedData : await Data.findOne()

  if (!data) {
    logger.error("qBittorrent | Could not find data object in db.")
    return false
  }

  if (!data.qBittorrent.cookie) {
    logger.error("qBittorrent | No Cookie!")
    return true
  }

  const cookieExpiry = data.qBittorrent?.cookie_expiry

  if (!cookieExpiry) {
    logger.warn("qBittorrent | Cookie expiry not set in data object.")
    return true // Assume expired if no expiry is set
  }

  // Return true = error/expired. False = valid.
  return moment().isAfter(moment(cookieExpiry))
}

// Renew qBittorrent cookie
export const renewqBitCookie = async (
  settings: settingsType,
  data: dataType,
): Promise<{
  cookie: string
  cookie_expiry: string
}> => {
  const response = {
    cookie: "",
    cookie_expiry: "",
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

    const { cookie, cookie_expiry } = await getqBitCookieFromHeaders(res, data)

    if (!cookie) {
      logger.error("renewqBitCookie: Failed to retrieve Cookie.")
      return response
    }

    logger.success("qBittorrent | Cookie Renewed!")

    return {
      cookie,
      cookie_expiry,
    }
  } catch (err) {
    logger.error(`qBittorrent | Cookie Renewal Error: ${axiosErrorMessage(err)}`)
  }

  return response
}

const updateQbitSettingsCookie = async (
  newCookie: string,
  expiry: string,
): Promise<settingsDocType> => {
  // Find settings object by ID
  let settings = (await Settings.findOne()) as settingsDocType

  // Throw error if no object was found
  if (!settings) {
    logger.error("updateQbitSettingsCookie: No settings found in database.")
  }

  settings.qBittorrent.cookie = newCookie
  settings.qBittorrent.cookie_expiry = expiry

  // save to the db
  await saveWithRetry(settings, "updateQbitSettingsCookie")

  return settings
}

// Get all current torrents
export const getqBittorrentTorrents = async (
  settings: settingsType,
  data: dataType,
  ident?: string,
): Promise<{
  torrents: Torrent[]
  cookieRenewed: boolean
  newCookie?: string
  newCookieExpiry?: string
  newSettings?: settingsDocType
}> => {
  // Only get qBittorrent data if 10 mins has passed since last update
  const firstRun = data.qBittorrent.torrents.length === 0

  if (!checkTimePassed(10, "minutes", data.qBittorrent.updated_at) && !firstRun) {
    const timer = 10 - moment().diff(moment(data.qBittorrent.updated_at), "minutes")

    logger.info(
      `qBittorrent | ${
        ident && `${ident} | `
      }Skipping Torrents retrieval. Only once per 10 minutes. ${timer} minutes left.`,
    )

    return {
      torrents: data.qBittorrent.torrents,
      cookieRenewed: false,
    }
  }

  let newSettings: settingsDocType | undefined = undefined
  let cookieRenewed = false
  let cookie = data.qBittorrent.cookie
  let newCookieExpiry = ""

  // Check cookie expiry and get a new cookie if needed
  if (await qBitCookieExpired(data)) {
    const { cookie: newCookie, cookie_expiry } = await renewqBitCookie(settings, data)
    cookie = newCookie
    newCookieExpiry = cookie_expiry

    if (newCookie) {
      cookieRenewed = true
      newSettings = await updateQbitSettingsCookie(newCookie, cookie_expiry)
    } else {
      logger.warn(
        `qBittorrent | ${
          ident && `${ident} | `
        }Cookie renewal attempted but new cookie was not set.`,
      )
    }
  }

  let torrents: Torrent[] = []

  try {
    const res = await axios.get(
      cleanUrl(`${settings.qBittorrent_URL}/api/${settings.qBittorrent_API_version}/torrents/info`),
      {
        headers: {
          cookie,
        },
      },
    )

    if (requestSuccess(res.status)) {
      logger.success(`qBittorrent | ${ident ? `${ident} | ` : ""}Retrieving torrents`)

      // Return all torrents and process the name to something that can be more easily matched with
      torrents = res.data.map((torrent: Torrent) => {
        return {
          ...torrent,
          processedName: torrent.name.toLowerCase().replace(/'/g, ""),
        }
      })
    } else {
      logger.error(
        `qBittorrent | ${ident ? `${ident} | ` : ""}Unknown error. Status: ${res.status} - ${
          res.statusText
        }`,
      )
    }
  } catch (err) {
    logger.error(`qBittorrent | ${ident ? `${ident} | ` : ""}Error: ${axiosErrorMessage(err)}`)
  }

  return {
    torrents,
    cookieRenewed,
    newCookie: cookie,
    newCookieExpiry,
    newSettings,
  }
}

// Get all current catagories
export const getqBittorrentCategories = async (
  settings: settingsType,
  cookie: string,
): Promise<TorrentCategory[]> => {
  let categories: TorrentCategory[] = []

  try {
    // Ensure that res.data is typed as CategoryResponse
    const res = await axios.get<{ [key: string]: TorrentCategory }>(
      cleanUrl(
        `${settings.qBittorrent_URL}/api/${settings.qBittorrent_API_version}/torrents/categories`,
      ),
      {
        headers: {
          cookie: cookie,
        },
      },
    )

    // Convert the object of categories to an array
    categories = Object.values(res.data).map((c) => ({
      name: c.name,
      savePath: c.savePath,
    }))
  } catch (err) {
    logger.error(`getqBittorrentCategories: Error: ${axiosErrorMessage(err)}`)
  }

  return categories
}

// Get all preferences
export const getqBittorrentPreferences = async (
  settings: settingsType,
  cookie: string,
): Promise<qBittorrentPreferences> => {
  let preferences = {} as qBittorrentPreferences

  try {
    const res = await axios.get(
      cleanUrl(
        `${settings.qBittorrent_URL}/api/${settings.qBittorrent_API_version}/app/preferences`,
      ),
      {
        headers: {
          cookie: cookie,
        },
      },
    )

    preferences = res.data
  } catch (err) {
    logger.error(`getqBittorrentPreferences: Error: ${axiosErrorMessage(err)}`)
  }

  return preferences
}

// Retrieve all data Automatarr requires from qBittorrent
export const getqBittorrentData = async (
  settings: settingsType,
  data: dataType,
): Promise<qBittorrent> => {
  // If qBittorent is not active, do not make any requests.
  if (!settings.qBittorrent_active) {
    logger.warn(
      `qBittorrent | Inactive! This application is quite limited without qBittorrent. Sorry about that.`,
    )
    return data.qBittorrent
  }

  // Only get qBittorrent data if 10 mins has passed since last update
  const firstRun = data.qBittorrent.torrents.length === 0

  if (!checkTimePassed(10, "minutes", data.qBittorrent.updated_at) && !firstRun) {
    const timer = 10 - moment().diff(moment(data.qBittorrent.updated_at), "minutes")

    logger.info(
      `qBittorrent | Skipping data retrieval. Only once per 10 minutes. ${timer} minutes left.`,
    )

    return data.qBittorrent
  }

  // Check if we have a cookie. If cookie expired, renew.
  if (await qBitCookieExpired(data)) {
    const { cookie, cookie_expiry } = await renewqBitCookie(settings, data)

    if (cookie) {
      data.qBittorrent.cookie = cookie
      data.qBittorrent.cookie_expiry = cookie_expiry
    } else {
      logger.error("getqBittorrentData: Failed to renew Cookie!")
      return data.qBittorrent
    }
  }

  const { torrents } = await getqBittorrentTorrents(settings, data)

  return {
    ...data.qBittorrent,
    torrents,
    categories: await getqBittorrentCategories(settings, data.qBittorrent.cookie),
    preferences: await getqBittorrentPreferences(settings, data.qBittorrent.cookie),
    updated_at: moment().format(),
  }
}

// Delete a qBittorrent torrent
export const deleteqBittorrent = async (
  settings: settingsType,
  cookie: string,
  torrent: Torrent,
): Promise<boolean> => {
  try {
    const res = await axios.post(
      cleanUrl(
        `${settings.qBittorrent_URL}/api/${settings.qBittorrent_API_version}/torrents/delete?hashes=${torrent.hash}&deleteFiles=true`,
      ),
      {
        headers: {
          cookie: cookie,
        },
      },
    )

    if (requestSuccess(res.status)) {
      logger.info(`Torrent deleted: ${torrent.name} 🔥`)
      return true
    } else {
      logger.error(`deleteqBittorrent: Unknown error. Status: ${res.status} - ${res.statusText}`)
    }
  } catch (err) {
    console.log(torrent)
    logger.error(`deleteqBittorrent: Error: ${axiosErrorMessage(err)}`)
  }

  return false
}
