import axios from "axios"
import { settingsType } from "../models/settings"
import { cleanUrl } from "./utility"
import logger from "../logger"
import { axiosErrorMessage } from "./requestError"
import {
  SABnzbdMiscConfig,
  SABnzbdPriority,
  SABnzbdQueue,
  SABnzbdSlot,
  SABnzbdSpeedState,
} from "../types/sabnzbdTypes"

// SABnzbd reports a job's priority by name. Map each name to the number the API accepts.
const priorityByName: Record<string, SABnzbdPriority> = {
  Force: 2,
  High: 1,
  Normal: 0,
  Low: -1,
}

// Send a request to the SABnzbd API. SABnzbd answers every request with HTTP 200,
// so a { status: false, error } body is turned into a thrown error.
const sabnzbdGet = async <T>(
  URL: string,
  KEY: string,
  params: Record<string, string | number>,
): Promise<T> => {
  const res = await axios.get(cleanUrl(`${URL}/api`), {
    params: { ...params, output: "json", apikey: KEY },
    timeout: 10000,
  })

  if (res.data?.status === false) {
    throw new Error(res.data.error ?? "Unknown SABnzbd error")
  }

  return res.data as T
}

// Check the SABnzbd connection and API key. Returns an HTTP-style status code.
export const checkSABnzbdConnection = async (URL: string, KEY: string): Promise<number> => {
  try {
    const data = await sabnzbdGet<{ queue?: unknown }>(URL, KEY, { mode: "queue", limit: 1 })
    return data.queue ? 200 : 500
  } catch (err) {
    logger.error(`SABnzbd | Error: ${axiosErrorMessage(err)}`)
    return 401
  }
}

// The raw queue job fields Automatarr reads
type RawSABnzbdSlot = {
  nzo_id: string
  filename: string
  status: string
  priority: string
  index: number | string
  percentage: number | string
  timeleft: string
  mbleft: number | string
}

// Get the SABnzbd queue with every job in queue order, and whether the queue is paused.
// Returns null if the request fails.
export const getSABnzbdQueueDetails = async (settings: settingsType): Promise<SABnzbdQueue | null> => {
  try {
    const data = await sabnzbdGet<{ queue: { paused: boolean; slots: RawSABnzbdSlot[] } }>(
      settings.sabnzbd_URL,
      settings.sabnzbd_KEY,
      { mode: "queue" },
    )

    return {
      paused: !!data.queue.paused,
      slots: data.queue.slots.map((slot) => ({
        nzo_id: slot.nzo_id,
        filename: slot.filename,
        status: slot.status,
        priority: priorityByName[slot.priority] ?? 0,
        index: Number(slot.index) || 0,
        percentage: Number(slot.percentage) || 0,
        timeleft: slot.timeleft ?? "",
        mbleft: Number(slot.mbleft) || 0,
      })),
    }
  } catch (err) {
    logger.error(`getSABnzbdQueue: ${axiosErrorMessage(err)}`)
    return null
  }
}

// Get every job in the SABnzbd queue in queue order. Returns null if the request fails.
export const getSABnzbdQueue = async (settings: settingsType): Promise<SABnzbdSlot[] | null> =>
  (await getSABnzbdQueueDetails(settings))?.slots ?? null

// Change a job's priority. SABnzbd moves the job to the back of its new priority group.
export const setSABnzbdPriority = async (
  settings: settingsType,
  nzoId: string,
  priority: SABnzbdPriority,
): Promise<boolean> => {
  try {
    await sabnzbdGet(settings.sabnzbd_URL, settings.sabnzbd_KEY, {
      mode: "queue",
      name: "priority",
      value: nzoId,
      value2: priority,
    })
    return true
  } catch (err) {
    logger.error(`setSABnzbdPriority: ${nzoId} | ${axiosErrorMessage(err)}`)
    return false
  }
}

// Move a job so it sits directly above another job in the queue
export const moveSABnzbdJob = async (
  settings: settingsType,
  nzoId: string,
  targetNzoId: string,
): Promise<boolean> => {
  try {
    await sabnzbdGet(settings.sabnzbd_URL, settings.sabnzbd_KEY, {
      mode: "switch",
      value: nzoId,
      value2: targetNzoId,
    })
    return true
  } catch (err) {
    logger.error(`moveSABnzbdJob: ${nzoId} | ${axiosErrorMessage(err)}`)
    return false
  }
}

// Read the queue's live speed and speed limit. Throws if SABnzbd can't be reached.
export const getSABnzbdSpeedState = async (settings: settingsType): Promise<SABnzbdSpeedState> => {
  const data = await sabnzbdGet<{
    queue: { paused: boolean; status: string; noofslots_total: number | string; kbpersec: string; speedlimit_abs: string }
  }>(settings.sabnzbd_URL, settings.sabnzbd_KEY, { mode: "queue", limit: 1 })

  return {
    paused: !!data.queue.paused,
    status: data.queue.status ?? "",
    jobs: Number(data.queue.noofslots_total) || 0,
    speed: (Number(data.queue.kbpersec) || 0) * 1024,
    limit: Number(data.queue.speedlimit_abs) || 0,
  }
}

// SABnzbd speeds such as "10M" or "500K" use binary suffixes. A plain number is bytes per second.
export const parseSABnzbdSpeed = (value: string | number | undefined): number => {
  const match = String(value ?? "").trim().match(/^([\d.]+)\s*([KMGTP]?)/i)
  if (!match) return 0

  const powers = ["", "K", "M", "G", "T", "P"]
  return Math.floor(Number(match[1]) * 1024 ** powers.indexOf(match[2].toUpperCase()))
}

// Read the settings that decide SABnzbd's speed limit. Throws if SABnzbd can't be reached.
export const getSABnzbdMiscConfig = async (settings: settingsType): Promise<SABnzbdMiscConfig> => {
  const data = await sabnzbdGet<{
    config: { misc: { bandwidth_max: string; bandwidth_perc: number | string; schedlines: string[] | string } }
  }>(settings.sabnzbd_URL, settings.sabnzbd_KEY, { mode: "get_config", section: "misc" })

  const misc = data.config.misc
  const schedlines = Array.isArray(misc.schedlines) ? misc.schedlines : misc.schedlines ? [misc.schedlines] : []

  return {
    bandwidth_max: parseSABnzbdSpeed(misc.bandwidth_max),
    bandwidth_perc: Number(misc.bandwidth_perc) || 0,
    schedlines,
  }
}

// Change one SABnzbd setting in the misc section. SABnzbd saves it to sabnzbd.ini, so it survives a restart.
// Throws if SABnzbd refuses, e.g. when the config is locked or only the NZB key was given.
export const setSABnzbdMiscConfig = async (
  settings: settingsType,
  keyword: "bandwidth_max" | "bandwidth_perc",
  value: string | number,
): Promise<void> => {
  await sabnzbdGet(settings.sabnzbd_URL, settings.sabnzbd_KEY, {
    mode: "set_config",
    section: "misc",
    keyword,
    value,
  })
}

// Set the running speed limit. Values from 1 to 100 are a percentage of "Maximum line speed".
// This isn't saved, so it only re-applies what the saved settings already say.
export const setSABnzbdSpeedLimit = async (settings: settingsType, value: string): Promise<void> => {
  await sabnzbdGet(settings.sabnzbd_URL, settings.sabnzbd_KEY, { mode: "config", name: "speedlimit", value })
}

// Turn a scheduled task on or off. The API has no schedule call, so this uses the same page SABnzbd's own
// Scheduling settings use. SABnzbd saves the change and reloads its scheduler. Throws on failure.
export const toggleSABnzbdSchedule = async (settings: settingsType, line: string): Promise<void> => {
  const res = await axios.get(cleanUrl(`${settings.sabnzbd_URL}/config/scheduling/toggleSchedule`), {
    params: { apikey: settings.sabnzbd_KEY, line },
    timeout: 10000,
    maxRedirects: 0,
    validateStatus: (status) => status >= 200 && status < 400,
  })

  if (res.status >= 300 && res.status < 400) return
  if (typeof res.data === "string" && res.data.toLowerCase().includes("denied")) {
    throw new Error(res.data)
  }
}
