import axios from "axios"
import { dataType, qBittorrent } from "../models/data"
import { settingsType } from "../models/settings"
import { cleanUrl, errCodeAndMsg } from "./utility"
import logger from "../logger"
import { qBittorrentPreferences, Torrent, TorrentCategory } from "../types/qBittorrentTypes"
import moment from "moment"

// Retreive qBittorrent cookie
export const getqBittorrentCookie = async (settings: settingsType): Promise<string> => {
  let cookie = ""

  try {
    const res = await axios.post(
      cleanUrl(
        `${settings.qBittorrent_URL}/api/${settings.qBittorrent_API_version}/auth/login?username=${settings.qBittorrent_username}&password=${settings.qBittorrent_password}`,
      ),
    )

    const cookiesInHeader = res.headers["set-cookie"]

    if (cookiesInHeader && cookiesInHeader.length > 0) {
      const regexedCookie = cookiesInHeader[0].match(/SID=[^;]+/)

      if (regexedCookie) {
        cookie = regexedCookie[0]
      } else {
        logger.error(`getqBittorrentData: Could not find cookie in set-cookie string.`)
      }
    } else {
      logger.error(`getqBittorrentData: Could not find cookie in response headers.`)
    }
  } catch (err) {
    logger.error(`getqBittorrentData: Error: ${errCodeAndMsg(err)}`)
  }

  return cookie
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

  const cookie = await getqBittorrentCookie(settings)

  return {
    ...data.qBittorrent,
    cookie: cookie,
    torrents: await getqBittorrentTorrents(settings, cookie),
    categories: await getqBittorrentCategories(settings, cookie),
    preferences: await getqBittorrentPreferences(settings, cookie),
    updated_at: moment().format(),
  }
}
