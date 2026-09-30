import axios from "axios"
import { settingsType } from "../models/settings"
import { cleanUrl } from "./utility"
import logger from "../logger"
import { axiosErrorMessage } from "./requestError"
import { SABnzbdPriority, SABnzbdSlot } from "../types/sabnzbdTypes"

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

// Get every job in the SABnzbd queue in queue order. Returns null if the request fails.
export const getSABnzbdQueue = async (settings: settingsType): Promise<SABnzbdSlot[] | null> => {
  try {
    const data = await sabnzbdGet<{
      queue: { slots: { nzo_id: string; filename: string; status: string; priority: string }[] }
    }>(settings.sabnzbd_URL, settings.sabnzbd_KEY, { mode: "queue" })

    return data.queue.slots.map((slot) => ({
      nzo_id: slot.nzo_id,
      filename: slot.filename,
      status: slot.status,
      priority: priorityByName[slot.priority] ?? 0,
    }))
  } catch (err) {
    logger.error(`getSABnzbdQueue: ${axiosErrorMessage(err)}`)
    return null
  }
}

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
