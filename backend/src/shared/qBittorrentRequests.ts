import axios, { AxiosResponse } from "axios"
import Data, { dataType, qBittorrent } from "../models/data"
import { settingsType } from "../models/settings"
import { cleanUrl, errCodeAndMsg } from "./utility"
import logger from "../logger"
import { qBittorrentPreferences, Torrent, TorrentCategory } from "../types/qBittorrentTypes"
import moment from "moment"

// Retreive qBittorrent cookie from check request headers
export const getqBitCookieFromHeaders = async (
  res: AxiosResponse<any, any>,
): Promise<string | undefined> => {
  const cookiesInHeader = res.headers["set-cookie"]

  if (!cookiesInHeader || cookiesInHeader.length === 0) {
    logger.error(`qBittorrent | Could not find cookie in response headers.`)
    return
  }

  const regexedCookie = cookiesInHeader[0].match(/SID=[^;]+/)

  if (!regexedCookie) {
    logger.error(`qBittorrent | Could not find cookie in set-cookie string.`)
    return
  }

  // Retreive the data object from the db
  const data = await Data.findOne()

  if (!data) {
    logger.error("qBittorrent | Could not find data object in db.")
    return
  }

  data.qBittorrent.cookie = regexedCookie[0]
  data.qBittorrent.cookie_expiry = moment()
    .add(data.qBittorrent.preferences?.web_ui_session_timeout || 3600, "seconds")
    .format()

  await data.save()

  return regexedCookie[0]
}

// Check if cookie has expired
export const qBitCookieExpired = async (): Promise<boolean> => {
  // Retrieve the data object from the db
  const data = await Data.findOne()

  if (!data) {
    logger.error("qBittorrent | Could not find data object in db.")
    return false
  }

  // Compare the current time with the cookie expiry
  const cookieExpiry = data.qBittorrent?.cookie_expiry

  if (!cookieExpiry) {
    logger.warn("qBittorrent | Cookie expiry not set in data object.")
    return true // Assume expired if no expiry is set
  }

  return moment().isAfter(moment(cookieExpiry))
}

// Get all current torrents
export const getqBittorrentTorrents = async (
  settings: settingsType,
  cookie: string,
): Promise<Torrent[]> => {
  let torrents: Torrent[] = []

  try {
    const res = await axios.get(
      cleanUrl(`${settings.qBittorrent_URL}/api/${settings.qBittorrent_API_version}/torrents/info`),
      {
        headers: {
          cookie: cookie,
        },
      },
    )

    torrents = res.data
  } catch (err) {
    logger.error(`getqBittorrentTorrents: Error: ${errCodeAndMsg(err)}`)
  }

  return torrents
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
    logger.error(`getqBittorrentCategories: Error: ${errCodeAndMsg(err)}`)
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
    logger.error(`getqBittorrentPreferences: Error: ${errCodeAndMsg(err)}`)
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
    return data.qBittorrent
  }

  if (!data.qBittorrent.cookie) {
    logger.error(`getqBittorrentData: No Cookie!`)
    return data.qBittorrent
  }

  return {
    ...data.qBittorrent,
    torrents: await getqBittorrentTorrents(settings, data.qBittorrent.cookie),
    categories: await getqBittorrentCategories(settings, data.qBittorrent.cookie),
    preferences: await getqBittorrentPreferences(settings, data.qBittorrent.cookie),
    updated_at: moment().format(),
  }
}
