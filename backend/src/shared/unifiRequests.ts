import axios, { AxiosResponse } from "axios"
import https from "https"
import crypto from "crypto"
import moment from "moment"
import logger from "../logger"
import { settingsType } from "../models/settings"
import {
  UnifiEnvelope,
  UnifiRawDevice,
  UnifiRawHealth,
  UnifiRawWan,
  UnifiRawWanConfig,
  UnifiRawWanStatus,
  UnifiSnapshot,
  UnifiSpeedtest,
  UnifiWan,
  UnifiWanMode,
} from "../types/unifiTypes"
import { axiosErrorMessage } from "./requestError"

// A strictly read-only client for the UniFi Network application on a UniFi OS console (UDM, UDM-SE, UCG, UXG).
// Every request is a GET. The only exception is the login POST, which is needed when no API key is given and
// changes nothing on the console.

const httpsAgent = new https.Agent({ rejectUnauthorized: false }) // UniFi consoles use a self-signed certificate
const TIMEOUT_MS = 4000
const CONFIG_TTL_MS = 10 * 60 * 1000 // ISP plans and WAN mode rarely change, so they're re-read every 10 minutes
const GATEWAY_TYPES = ["udm", "uxg", "ugw"]
const LOGIN_RETRY_MS = 30 * 1000 // Wait after the first failed login, doubled after each further failure
const LOGIN_LOCKOUT_MS = 30 * 60 * 1000 // Wait after MAX_LOGIN_FAILURES, so the console doesn't lock the account
const MAX_LOGIN_FAILURES = 3

// The connection details for one console
export type UnifiCredentials = {
  URL: string
  KEY: string
  USER: string
  PASS: string
  SITE: string
}

type UnifiSession = { credKey: string; cookie: string; csrf: string }
type LoginFailures = { credKey: string; count: number; until: number }
type WanConfig = {
  plans: Map<string, { name: string | null; down: number | null; up: number | null }>
  mode: UnifiWanMode
  states: Map<string, string> // WAN group to "ACTIVE" or "BACKUP". Empty when the gateway doesn't say
  health: UnifiRawHealth[]
}

let session: UnifiSession | null = null
let loginFailures: LoginFailures = { credKey: "", count: 0, until: 0 }
let wanConfigCache: { credKey: string; at: number; value: WanConfig } | null = null
let gatewayCache: { credKey: string; mac: string | null } | null = null

// Read the UniFi connection details from settings
export const unifiCredentials = (settings: settingsType): UnifiCredentials => ({
  URL: settings.unifi_URL,
  KEY: settings.unifi_KEY,
  USER: settings.unifi_username,
  PASS: settings.unifi_password,
  SITE: settings.unifi_site || "default",
})

// True when there's a URL and either an API key or a username and password
export const hasUnifiCredentials = (creds: UnifiCredentials): boolean =>
  !!creds.URL && (!!creds.KEY || (!!creds.USER && !!creds.PASS))

// A short fingerprint of the connection details, so caches and sessions are dropped when they change
const credKeyOf = (creds: UnifiCredentials): string =>
  crypto.createHash("sha256").update([creds.URL, creds.KEY, creds.USER, creds.PASS].join("|")).digest("hex")

// The console's address with https:// added when no scheme was given, and without a trailing slash
const baseUrl = (URL: string): string => (/^https?:\/\//i.test(URL) ? URL : `https://${URL}`).replace(/\/+$/, "")

// When logging in is paused after failed attempts, for the Network page. Null = not paused
export const getUnifiLoginPause = (): string | null =>
  loginFailures.until > Date.now() ? moment(loginFailures.until).format() : null

// Log in with a local UniFi account and keep the session. Failed logins back off, so a wrong password can't
// lock the account on the console.
const login = async (creds: UnifiCredentials, credKey: string): Promise<UnifiSession> => {
  if (loginFailures.credKey === credKey && loginFailures.until > Date.now()) {
    throw new Error(`Login paused until ${moment(loginFailures.until).format("HH:mm")} after failed attempts`)
  }

  const res = await axios.post(
    `${baseUrl(creds.URL)}/api/auth/login`,
    { username: creds.USER, password: creds.PASS, rememberMe: true },
    { httpsAgent, timeout: TIMEOUT_MS, validateStatus: () => true },
  )

  const cookie = (res.headers["set-cookie"] ?? []).map((c) => c.match(/TOKEN=[^;]+/)?.[0]).find(Boolean)

  if (res.status !== 200 || !cookie) {
    const count = loginFailures.credKey === credKey ? loginFailures.count + 1 : 1
    const wait = count >= MAX_LOGIN_FAILURES ? LOGIN_LOCKOUT_MS : LOGIN_RETRY_MS * 2 ** (count - 1)
    loginFailures = { credKey, count, until: Date.now() + wait }
    throw new Error(`Login failed with status ${res.status}`)
  }

  loginFailures = { credKey: "", count: 0, until: 0 }
  session = { credKey, cookie, csrf: String(res.headers["x-csrf-token"] ?? "") }
  return session
}

// Send one GET with whichever authentication the settings give
const authorisedGet = async (creds: UnifiCredentials, path: string): Promise<AxiosResponse> => {
  const url = `${baseUrl(creds.URL)}/proxy/network${path}`
  const options = { httpsAgent, timeout: TIMEOUT_MS, validateStatus: () => true }

  if (creds.KEY) {
    return axios.get(url, { ...options, headers: { "X-API-Key": creds.KEY, Accept: "application/json" } })
  }

  if (!creds.USER || !creds.PASS) throw new Error("No API key or username and password")

  const credKey = credKeyOf(creds)

  // A rejected session is replaced with one new login, never more, so a bad account can't spiral into a lockout
  for (let attempt = 0; attempt < 2; attempt++) {
    const current = session?.credKey === credKey ? session : await login(creds, credKey)
    const res = await axios.get(url, {
      ...options,
      headers: { cookie: current.cookie, "X-CSRF-Token": current.csrf, Accept: "application/json" },
    })

    const updatedCsrf = res.headers["x-updated-csrf-token"]
    if (updatedCsrf) current.csrf = String(updatedCsrf)

    if (res.status !== 401) return res
    session = null
  }

  throw new Error("UniFi rejected the login session")
}

// GET a UniFi Network path and return the body. Throws on any status other than 200
const unifiGet = async <T>(creds: UnifiCredentials, path: string): Promise<T> => {
  const res = await authorisedGet(creds, path)
  if (res.status !== 200) throw new Error(`UniFi answered ${res.status} for ${path}`)
  return res.data as T
}

// GET a legacy UniFi Network path and unwrap its { meta, data } envelope
const unifiLegacy = async <T>(creds: UnifiCredentials, path: string): Promise<T[]> => {
  const body = await unifiGet<UnifiEnvelope<T>>(creds, `/api/s/${creds.SITE}${path}`)
  if (body?.meta?.rc !== "ok") throw new Error(body?.meta?.msg ?? `Unexpected response for ${path}`)
  return body.data
}

// Check the console can be reached and the credentials work. Returns an HTTP-style status code
export const checkUnifiConnection = async (creds: UnifiCredentials): Promise<number> => {
  try {
    await unifiLegacy<UnifiRawHealth>(creds, "/stat/health")
    return 200
  } catch (err) {
    logger.error(`UniFi | Error: ${axiosErrorMessage(err)}`)
    return 401
  }
}

// Bits to bytes for UniFi's Mbps and kbps figures
const mbps = (value: number | undefined): number => (Number(value) || 0) * 125_000
const kbps = (value: number | undefined): number | null => (Number(value) > 0 ? Number(value) * 125 : null)

// Read each WAN's ISP plan. The v2 API is tried first, then the older network list
const readWanPlans = async (creds: UnifiCredentials): Promise<UnifiRawWanConfig[]> => {
  try {
    const enriched = await unifiGet<{ configuration: UnifiRawWanConfig }[]>(
      creds,
      `/v2/api/site/${creds.SITE}/wan/enriched-configuration`,
    )
    return enriched.map((e) => e.configuration).filter(Boolean)
  } catch {
    const networks = await unifiLegacy<UnifiRawWanConfig>(creds, "/rest/networkconf")
    return networks.filter((n) => n.purpose === "wan")
  }
}

// Read whether the WANs fail over or share traffic, and which are active. Newer Network versions list each WAN as
// ACTIVE or BACKUP; older ones give a mode, and the oldest only have each WAN's own load balance setting.
const readWanStatus = async (
  creds: UnifiCredentials,
  configs: UnifiRawWanConfig[],
): Promise<{ mode: UnifiWanMode; states: Map<string, string> }> => {
  const states = new Map<string, string>()

  try {
    const status = await unifiGet<UnifiRawWanStatus>(creds, `/v2/api/site/${creds.SITE}/wan/load-balancing/status`)
    if (status.mode === "FAILOVER_ONLY") return { mode: "failover", states }
    if (status.mode === "DISTRIBUTED") return { mode: "distributed", states }

    for (const wan of status.wan_interfaces ?? []) {
      if (wan.wan_networkgroup && wan.state) states.set(wan.wan_networkgroup, wan.state)
    }

    if (states.size > 0) {
      const active = [...states.values()].filter((s) => s === "ACTIVE").length
      return { mode: active > 1 ? "distributed" : "failover", states }
    }
  } catch {
    // Older Network versions don't have this endpoint
  }

  const types = configs.map((c) => c.wan_load_balance_type).filter(Boolean)
  if (types.includes("failover-only")) return { mode: "failover", states }
  if (types.length > 1) return { mode: "distributed", states }
  return { mode: "unknown", states }
}

// Read the slow-changing parts of the network: ISP plans, WAN mode and health. Cached for 10 minutes
const getWanConfig = async (creds: UnifiCredentials): Promise<WanConfig> => {
  const credKey = credKeyOf(creds)
  if (wanConfigCache?.credKey === credKey && Date.now() - wanConfigCache.at < CONFIG_TTL_MS) {
    return wanConfigCache.value
  }

  const configs = await readWanPlans(creds).catch(() => [] as UnifiRawWanConfig[])
  const plans = new Map(
    configs.map((c) => [
      c.wan_networkgroup ?? "WAN",
      {
        name: c.name ?? null,
        down: kbps(c.wan_provider_capabilities?.download_kilobits_per_second),
        up: kbps(c.wan_provider_capabilities?.upload_kilobits_per_second),
      },
    ]),
  )

  const value: WanConfig = {
    plans,
    ...(await readWanStatus(creds, configs)),
    health: await unifiLegacy<UnifiRawHealth>(creds, "/stat/health"),
  }

  wanConfigCache = { credKey, at: Date.now(), value }
  return value
}

// Find the gateway's MAC address. Remembered until the connection details change
const findGatewayMac = async (creds: UnifiCredentials): Promise<string | null> => {
  const credKey = credKeyOf(creds)
  if (gatewayCache?.credKey === credKey) return gatewayCache.mac

  const devices = await unifiLegacy<UnifiRawDevice>(creds, "/stat/device-basic").catch(() =>
    unifiLegacy<UnifiRawDevice>(creds, "/stat/device"),
  )

  const gateway = devices.find((d) => GATEWAY_TYPES.includes(String(d.type)) || "wan1" in d)
  gatewayCache = { credKey, mac: gateway?.mac ?? null }
  return gatewayCache.mac
}

// Whether a WAN port is carrying traffic. The gateway's own ACTIVE/BACKUP list is trusted first
const isActiveWan = (device: UnifiRawDevice, config: WanConfig, group: string, raw: UnifiRawWan): boolean => {
  if (config.states.size > 0) return config.states.get(group) === "ACTIVE"
  return !!raw.is_uplink || (!!device.uplink?.ifname && device.uplink.ifname === raw.ifname)
}

// Turn the gateway's wan1, wan2 etc into WANs with their ISP plans. "wan1" is UniFi's "WAN" group,
// "wan2" is "WAN2" and so on. When only one WAN is active its traffic is read from the gateway's uplink instead
// of the port, because over PPPoE the port also counts traffic that isn't internet traffic (15-20% more on a
// UDM-SE), while the uplink is the PPPoE session itself and matches UniFi's own WAN health and speedtests.
const parseDeviceWans = (device: UnifiRawDevice, config: WanConfig): UnifiWan[] => {
  const wanKeys = Object.keys(device)
    .filter((key) => /^wan\d+$/.test(key))
    .sort()

  const wans = wanKeys
    .map((key) => ({ key, raw: device[key] as UnifiRawWan }))
    .filter(({ raw }) => raw && typeof raw === "object" && raw.enable !== false)
    .map(({ key, raw }) => {
      const number = key.slice(3)
      const group = number === "1" ? "WAN" : `WAN${number}`
      const plan = config.plans.get(group)
      const active = isActiveWan(device, config, group, raw)
      const traffic = active && config.mode !== "distributed" && device.uplink ? device.uplink : raw

      return {
        group,
        name: plan?.name || raw.name || group,
        up: !!raw.up,
        active,
        down: Number(traffic["rx_bytes-r"]) || 0,
        upload: Number(traffic["tx_bytes-r"]) || 0,
        plan_down: plan?.down ?? null,
        plan_up: plan?.up ?? null,
      }
    })

  if (wans.length > 0 || !device.uplink) return wans

  // Gateways that don't list their WAN ports separately still report the active uplink
  const plan = config.plans.get("WAN")
  return [
    {
      group: "WAN",
      name: plan?.name || device.uplink.name || "WAN",
      up: device.uplink.up !== false,
      active: true,
      down: Number(device.uplink["rx_bytes-r"]) || 0,
      upload: Number(device.uplink["tx_bytes-r"]) || 0,
      plan_down: plan?.down ?? null,
      plan_up: plan?.up ?? null,
    },
  ]
}

// Without a gateway device, the site's WAN health still gives the overall WAN traffic
const healthWans = (health: UnifiRawHealth[], config: WanConfig): UnifiWan[] => {
  const wan = health.find((h) => h.subsystem === "wan")
  if (!wan) return []

  const plan = config.plans.get("WAN")
  return [
    {
      group: "WAN",
      name: plan?.name || "WAN",
      up: wan.status !== "error",
      active: true,
      down: Number(wan["rx_bytes-r"]) || 0,
      upload: Number(wan["tx_bytes-r"]) || 0,
      plan_down: plan?.down ?? null,
      plan_up: plan?.up ?? null,
    },
  ]
}

// The last speedtest, from the gateway when it has one, otherwise from the site's health. A test that ran on a WAN
// that isn't active now (e.g. before a failover) is ignored, so a slow backup line isn't assumed to be fast
const parseSpeedtest = (device: UnifiRawDevice | null, health: UnifiRawHealth[]): UnifiSpeedtest | null => {
  const test = device?.["speedtest-status"]
  const activeInterfaces = [device?.uplink?.name, device?.uplink?.ifname].filter(Boolean)
  const ranElsewhere = !!test?.interface_name && activeInterfaces.length > 0 && !activeInterfaces.includes(test.interface_name)
  if (ranElsewhere) return null

  if (test && Number(test.xput_download) > 0) {
    return {
      down: mbps(test.xput_download),
      up: mbps(test.xput_upload),
      at: test.rundate ? moment.unix(test.rundate).format() : null,
    }
  }

  const www = health.find((h) => h.subsystem === "www")
  if (www && Number(www.xput_down) > 0) {
    return {
      down: mbps(www.xput_down),
      up: mbps(www.xput_up),
      at: www.speedtest_lastrun ? moment.unix(www.speedtest_lastrun).format() : null,
    }
  }

  return null
}

// Read live WAN traffic, ISP plans and the last speedtest. Throws if the console can't be reached
export const getUnifiSnapshot = async (settings: settingsType): Promise<UnifiSnapshot> => {
  const creds = unifiCredentials(settings)
  if (!hasUnifiCredentials(creds)) throw new Error("UniFi isn't set up")

  const config = await getWanConfig(creds)
  const mac = await findGatewayMac(creds)
  const device = mac ? (await unifiLegacy<UnifiRawDevice>(creds, `/stat/device/${mac}`))[0] ?? null : null

  // The gateway can't be read live, so fall back to the site's health, which is refreshed for every request
  const health = device ? config.health : await unifiLegacy<UnifiRawHealth>(creds, "/stat/health")
  const wans = device ? parseDeviceWans(device, config) : healthWans(health, config)

  return {
    wans,
    mode: config.mode,
    isp_name: health.find((h) => h.subsystem === "wan")?.isp_name ?? null,
    latency:
      Number(device?.uplink?.latency) || Number(health.find((h) => h.subsystem === "www")?.latency) || null,
    speedtest: parseSpeedtest(device, health),
  }
}
