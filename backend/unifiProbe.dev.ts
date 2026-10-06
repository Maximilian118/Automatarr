// Read-only probe of a UniFi OS console, to confirm the fields the network balancer reads exist on your firmware.
// Not compiled into the app (*.dev.ts). Only GET requests are sent, plus a login when no API key is given.
//
// Usage:
//   UNIFI_URL=https://192.168.1.1 UNIFI_KEY=... npx ts-node -T unifiProbe.dev.ts
//   UNIFI_URL=https://192.168.1.1 UNIFI_USER=... UNIFI_PASS=... [UNIFI_SITE=default] npx ts-node -T unifiProbe.dev.ts
//
// Then compare the result with what Automatarr shows on the Network page, using the real parser:
//   ... npx ts-node -T unifiProbe.dev.ts --snapshot

import axios from "axios"
import https from "https"
import { getUnifiSnapshot } from "./src/shared/unifiRequests"
import { settingsType } from "./src/models/settings"

const URL = (process.env.UNIFI_URL ?? "").replace(/\/+$/, "")
const KEY = process.env.UNIFI_KEY ?? ""
const USER = process.env.UNIFI_USER ?? ""
const PASS = process.env.UNIFI_PASS ?? ""
const SITE = process.env.UNIFI_SITE || "default"

const httpsAgent = new https.Agent({ rejectUnauthorized: false })
let headers: Record<string, string> = { Accept: "application/json" }

// Log in with a local account when no API key is given
const authenticate = async (): Promise<void> => {
  if (KEY) {
    headers["X-API-Key"] = KEY
    return
  }

  const res = await axios.post(`${URL}/api/auth/login`, { username: USER, password: PASS }, { httpsAgent })
  const cookie = (res.headers["set-cookie"] ?? []).map((c) => c.split(";")[0]).join("; ")
  headers = { ...headers, cookie, "X-CSRF-Token": String(res.headers["x-csrf-token"] ?? "") }
}

// GET a path and print its status, or the error
const get = async (path: string): Promise<unknown> => {
  try {
    const res = await axios.get(`${URL}/proxy/network${path}`, { httpsAgent, headers, timeout: 8000 })
    console.log(`\n✓ ${path} (${res.status})`)
    return res.data
  } catch (err) {
    const status = axios.isAxiosError(err) ? err.response?.status : undefined
    console.log(`\n✗ ${path} (${status ?? String(err)})`)
    return null
  }
}

// Print only the named fields of an object
const pickFields = (obj: Record<string, unknown> | undefined, fields: string[]) =>
  Object.fromEntries(fields.filter((f) => obj && f in obj).map((f) => [f, obj?.[f]]))

const WAN_FIELDS = ["name", "ifname", "up", "enable", "is_uplink", "rx_bytes-r", "tx_bytes-r", "max_speed", "latency"]

const probe = async (): Promise<void> => {
  if (!URL || (!KEY && !(USER && PASS))) {
    console.log("Set UNIFI_URL and either UNIFI_KEY or UNIFI_USER and UNIFI_PASS.")
    process.exit(1)
  }

  if (process.argv.includes("--snapshot")) {
    const settings = {
      unifi_URL: URL,
      unifi_KEY: KEY,
      unifi_username: USER,
      unifi_password: PASS,
      unifi_site: SITE,
    } as settingsType
    console.dir(await getUnifiSnapshot(settings), { depth: 5 })
    return
  }

  await authenticate()

  const health = (await get(`/api/s/${SITE}/stat/health`)) as { data?: Record<string, unknown>[] } | null
  for (const sub of health?.data?.filter((h) => ["wan", "www"].includes(String(h.subsystem))) ?? []) {
    console.dir(
      pickFields(sub, ["subsystem", "status", "rx_bytes-r", "tx_bytes-r", "isp_name", "latency", "xput_down", "xput_up", "speedtest_lastrun"]),
    )
  }

  const basic = (await get(`/api/s/${SITE}/stat/device-basic`)) as { data?: Record<string, unknown>[] } | null
  console.dir(basic?.data?.map((d) => pickFields(d, ["mac", "type", "model", "name"])))

  const gateway = basic?.data?.find((d) => ["udm", "uxg", "ugw"].includes(String(d.type)))
  if (gateway) {
    const device = (await get(`/api/s/${SITE}/stat/device/${gateway.mac}`)) as { data?: Record<string, unknown>[] } | null
    const gw = device?.data?.[0]
    const wanKeys = Object.keys(gw ?? {}).filter((k) => /^wan\d+$/.test(k))
    console.log("WAN keys:", wanKeys)
    for (const key of wanKeys) console.dir({ [key]: pickFields(gw?.[key] as Record<string, unknown>, WAN_FIELDS) })
    console.dir({ uplink: pickFields(gw?.uplink as Record<string, unknown>, WAN_FIELDS) })
    console.dir({ "speedtest-status": gw?.["speedtest-status"] })
  } else {
    console.log("\nNo gateway found in stat/device-basic.")
  }

  const enriched = (await get(`/v2/api/site/${SITE}/wan/enriched-configuration`)) as
    | { configuration?: Record<string, unknown> }[]
    | null
  console.dir(
    enriched?.map((e) =>
      pickFields(e.configuration, ["name", "wan_networkgroup", "wan_load_balance_type", "wan_provider_capabilities"]),
    ),
    { depth: 4 },
  )

  console.dir(await get(`/v2/api/site/${SITE}/wan/load-balancing/status`), { depth: 4 })
}

probe().catch((err) => {
  console.error(err)
  process.exit(1)
})
