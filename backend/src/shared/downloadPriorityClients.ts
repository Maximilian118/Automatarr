import axios from "axios"
import Data, { dataDocType } from "../models/data"
import { settingsType } from "../models/settings"
import logger from "../logger"
import { cleanUrl } from "./utility"
import { axiosErrorMessage } from "./requestError"
import { DownloadStatus } from "../types/types"
import { getSABnzbdQueue, moveSABnzbdJob, setSABnzbdPriority } from "./sabnzbdRequests"
import {
  getqBittorrentPreferences,
  getqBittorrentTorrentsByHash,
  getValidqBitCookie,
  renewqBitCookie,
  topPrioqBittorrent,
} from "./qBittorrentRequests"
import { planqBittorrentMoves, planSABnzbdMoves } from "./downloadPriorityUtility"

// Only warn about qBittorrent queueing being disabled once, until it's turned on
let qBitQueueingWarned = false

// Get the connection details for a Starr app that downloads films or series
const starrConnection = (settings: settingsType, app: "Radarr" | "Sonarr") =>
  app === "Radarr"
    ? {
        active: settings.radarr_active,
        URL: settings.radarr_URL,
        KEY: settings.radarr_KEY,
        version: settings.radarr_API_version,
      }
    : {
        active: settings.sonarr_active,
        URL: settings.sonarr_URL,
        KEY: settings.sonarr_KEY,
        version: settings.sonarr_API_version,
      }

// Get every record in a Starr app's download queue without logging on success.
// Returns an empty array if the app isn't active and null if the request fails,
// so a failed request is never mistaken for an empty queue.
export const getStarrQueueRecords = async (
  settings: settingsType,
  app: "Radarr" | "Sonarr",
): Promise<DownloadStatus[] | null> => {
  const { active, URL, KEY, version } = starrConnection(settings, app)
  if (!active) return []

  try {
    const res = await axios.get(cleanUrl(`${URL}/api/${version}/queue`), {
      params: { page: 1, pageSize: 1000, apikey: KEY },
      timeout: 15000,
    })

    return res.data.records as DownloadStatus[]
  } catch (err) {
    logger.error(`Download Priority | ${app} queue: ${axiosErrorMessage(err)}`)
    return null
  }
}

// Put the given SABnzbd jobs at the front of the queue in the given order
export const applySABnzbdOrder = async (settings: settingsType, nzoIds: string[]): Promise<void> => {
  if (!settings.sabnzbd_active || nzoIds.length === 0) return

  const queue = await getSABnzbdQueue(settings)
  if (!queue) return

  const moves = planSABnzbdMoves(queue, nzoIds)

  // Stop at the first failure. The next pass re-plans from a fresh queue.
  for (const move of moves) {
    const moved =
      move.type === "priority"
        ? await setSABnzbdPriority(settings, move.nzoId, 1)
        : await moveSABnzbdJob(settings, move.nzoId, move.targetNzoId)

    if (!moved) return
  }

  if (moves.length > 0) {
    logger.info(`Download Priority | SABnzbd | Reordered the queue with ${moves.length} change(s).`)
  }
}

// Return SABnzbd jobs that were promoted to High back to Normal priority
export const resetSABnzbdPriorities = async (
  settings: settingsType,
  nzoIds: string[],
): Promise<void> => {
  if (!settings.sabnzbd_active || nzoIds.length === 0) return

  const queue = await getSABnzbdQueue(settings)
  if (!queue) return

  for (const slot of queue.filter((s) => nzoIds.includes(s.nzo_id) && s.priority === 1)) {
    await setSABnzbdPriority(settings, slot.nzo_id, 0)
  }
}

// Get a valid qBittorrent cookie, saving it to the database if it had to be renewed.
// Only the qBittorrent cookie fields are read and written so the rest of the data object is untouched.
const getPriorityqBitCookie = async (
  settings: settingsType,
  forceRenew: boolean,
): Promise<string> => {
  const data = (await Data.findOne(
    {},
    {
      "qBittorrent.cookie": 1,
      "qBittorrent.cookie_expiry": 1,
      "qBittorrent.preferences": 1,
    },
  ).lean()) as dataDocType | null

  if (!data?.qBittorrent) return ""

  const oldCookie = data.qBittorrent.cookie
  const cookie = forceRenew
    ? (await renewqBitCookie(settings, data)).cookie
    : await getValidqBitCookie(settings, data)

  if (cookie && cookie !== oldCookie) {
    await Data.updateOne(
      { _id: data._id },
      {
        $set: {
          "qBittorrent.cookie": data.qBittorrent.cookie,
          "qBittorrent.cookie_expiry": data.qBittorrent.cookie_expiry,
        },
      },
    )
  }

  return cookie
}

// Put the given torrents at the top of the qBittorrent queue in the given order.
// qBittorrent only has a download order when Torrent Queueing is enabled.
export const applyqBittorrentOrder = async (
  settings: settingsType,
  hashes: string[],
): Promise<void> => {
  if (!settings.qBittorrent_active || hashes.length === 0) return

  const cookie = await getPriorityqBitCookie(settings, false)
  if (!cookie) return

  const preferences = await getqBittorrentPreferences(settings, cookie)

  // An empty response means the request failed. A rejected cookie usually means qBittorrent
  // restarted, so renew it ready for the next pass.
  if (Object.keys(preferences).length === 0) {
    await getPriorityqBitCookie(settings, true)
    return
  }

  if (!preferences.queueing_enabled) {
    if (!qBitQueueingWarned) {
      logger.warn(
        "Download Priority | qBittorrent | Torrent Queueing is disabled, so every torrent downloads at once. Enable it in qBittorrent for Discord requests to jump the queue.",
      )
      qBitQueueingWarned = true
    }
    return
  }

  qBitQueueingWarned = false

  const torrents = await getqBittorrentTorrentsByHash(settings, cookie, hashes)
  if (!torrents) return

  const moves = planqBittorrentMoves(torrents, hashes)

  for (const hash of moves) {
    if (!(await topPrioqBittorrent(settings, cookie, hash))) return
  }

  if (moves.length > 0) {
    logger.info(`Download Priority | qBittorrent | Moved ${moves.length} torrent(s) to the top.`)
  }
}
