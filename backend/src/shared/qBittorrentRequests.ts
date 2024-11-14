import axios from "axios"
import { dataType, qBittorrent } from "../models/data"
import { settingsType } from "../models/settings"
import { cleanUrl, errCodeAndMsg } from "./utility"
import logger from "../logger"
import { Torrent } from "../types/qBittorrentTypes"

// Retreive qBittorrent cookie
export const getqBittorrentCookie = async (settings: settingsType): Promise<string> => {
  let cookie = ""

  try {
    const res = await axios.post(
      cleanUrl(
        `${settings.qBittorrent_URL}/api/v2/auth/login?username=${settings.qBittorrent_username}&password=${settings.qBittorrent_password}`,
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
  const torrents: Torrent[] = []

  try {
    const res = await axios.get(cleanUrl(`${settings.qBittorrent_URL}/api/v2/torrents/info`), {
      headers: {
        cookie: cookie,
      },
    })

    return res.data
  } catch (err) {
    logger.error(`getqBittorrentTorrents: Error: ${errCodeAndMsg(err)}`)
  }

  return torrents
}

// Retrieve all data Automatarr requires from qBittorrent
export const getqBittorrentData = async (
  settings: settingsType,
  data: dataType,
): Promise<qBittorrent> => {
  const cookie = await getqBittorrentCookie(settings)

  return {
    ...data.qBittorrent,
    cookie: cookie,
    torrents: await getqBittorrentTorrents(settings, cookie),
  }
}
