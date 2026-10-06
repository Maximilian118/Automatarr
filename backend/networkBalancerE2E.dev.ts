// End-to-end check of the network balancer. Not compiled into the app (*.dev.ts).
// Runs the real balancer, request code and database against fake SABnzbd, qBittorrent and UniFi servers on
// localhost and a throwaway in-memory database. Nothing outside this process is touched.
//
// Usage: npx ts-node -T networkBalancerE2E.dev.ts

import assert from "node:assert/strict"
import express from "express"
import { AddressInfo } from "net"
import mongoose from "mongoose"
import { MongoMemoryServer } from "mongodb-memory-server"
import Settings from "./src/models/settings"
import Data from "./src/models/data"
import NetworkBalancer from "./src/models/networkBalancer"
import {
  disableNetworkBalancer,
  enableNetworkBalancer,
  getBalancerReading,
  nudgeNetworkBalancer,
  startNetworkBalancer,
  updateNetworkBalancerConfig,
} from "./src/shared/networkBalancer"
import { runShutdownHooks } from "./src/shared/shutdownHooks"
import { KIB, mbpsToBps } from "./src/shared/networkBalancerMath"

const M = mbpsToBps

// What each fake client wants to download right now, and household traffic, in bytes per second
const demand = { sab: 0, qbit: 0, qbitUp: 0, household: 0 }

// A fake SABnzbd that applies limits the way SABnzbd 4/5 does
const sab = {
  up: true,
  bandwidth_max: 0, // Not set, so SABnzbd starts with no limit
  bandwidth_perc: 100,
  limit: 0,
  paused: false,
  schedlines: ["1 0 8 1234567 speedlimit 50", "1 0 23 1234567 pause"],
}
const sabSpeed = () => (sab.paused ? 0 : Math.min(demand.sab, sab.limit || Infinity))
const sabSpeedSet = () => {
  sab.limit = sab.bandwidth_max && sab.bandwidth_perc ? Math.floor((sab.bandwidth_max * sab.bandwidth_perc) / 100) : 0
}

// A fake qBittorrent with normal and alternative limits, in bytes per second. 0 = no limit
const qbit = {
  up: true,
  prefs: {
    dl_limit: 0,
    up_limit: 0,
    alt_dl_limit: 10240,
    alt_up_limit: 0,
    scheduler_enabled: true,
    limit_utp_rate: false,
    web_ui_session_timeout: 3600,
    schedule_from_hour: 8,
    schedule_from_min: 0,
    schedule_to_hour: 20,
    schedule_to_min: 0,
  } as Record<string, number | boolean>,
  alt: false,
}
const qbitLimit = (dir: "dl" | "up") => Number(qbit.alt ? qbit.prefs[`alt_${dir}_limit`] : qbit.prefs[`${dir}_limit`])
const qbitSpeed = () => Math.min(demand.qbit, qbitLimit("dl") || Infinity)
const qbitUpSpeed = () => Math.min(demand.qbitUp, qbitLimit("up") || Infinity)

// Start an express app on a random local port and return its URL
const serve = (app: express.Express): Promise<string> =>
  new Promise((resolve) => {
    const server = app.listen(0, "127.0.0.1", () => resolve(`http://127.0.0.1:${(server.address() as AddressInfo).port}`))
  })

const fakeSABnzbd = (): Promise<string> => {
  const app = express()

  app.use((req, res, next) => (sab.up ? next() : res.status(503).end()))

  app.get("/api", (req, res) => {
    const { mode, name, keyword, value } = req.query as Record<string, string>
    const misc = () => ({ bandwidth_max: String(sab.bandwidth_max || ""), bandwidth_perc: sab.bandwidth_perc, schedlines: sab.schedlines })

    if (mode === "queue") {
      const speed = sabSpeed()
      return res.json({
        queue: {
          paused: sab.paused,
          status: sab.paused ? "Paused" : speed > 0 ? "Downloading" : "Idle",
          noofslots_total: demand.sab > 0 ? 1 : 0,
          kbpersec: (speed / 1024).toFixed(2),
          speedlimit_abs: String(sab.limit),
        },
      })
    }
    if (mode === "get_config") return res.json({ config: { misc: misc() } })
    if (mode === "set_config") {
      if (keyword === "bandwidth_max") sab.bandwidth_max = Number(value)
      if (keyword === "bandwidth_perc") sab.bandwidth_perc = Number(value)
      sabSpeedSet()
      return res.json({ config: { misc: misc() } })
    }
    if (mode === "config" && name === "speedlimit") {
      const v = Number(value)
      sab.limit = v > 0 && v < 101 ? Math.floor((sab.bandwidth_max * v) / 100) : v
      return res.json({ status: true })
    }
    return res.json({ status: false, error: "not faked" })
  })

  app.get("/config/scheduling/toggleSchedule", (req, res) => {
    const line = String(req.query.line)
    sab.schedlines = sab.schedlines.map((l) => (l === line ? `${l[0] === "1" ? "0" : "1"}${l.slice(1)}` : l))
    res.redirect(303, "/config/scheduling/")
  })

  return serve(app)
}

const fakeqBittorrent = (): Promise<string> => {
  const app = express()
  app.use(express.urlencoded({ extended: false }))
  app.use((req, res, next) => (qbit.up ? next() : res.status(503).end()))

  app.post("/api/v2/auth/login", (_req, res) => res.setHeader("set-cookie", "SID=fake; path=/").send("Ok."))
  app.get("/api/v2/app/preferences", (_req, res) => res.json(qbit.prefs))
  app.post("/api/v2/app/setPreferences", (req, res) => {
    Object.assign(qbit.prefs, JSON.parse(req.body.json))
    res.send("")
  })
  app.get("/api/v2/transfer/info", (_req, res) =>
    res.json({
      dl_info_speed: qbitSpeed(),
      up_info_speed: qbitUpSpeed(),
      dl_rate_limit: qbitLimit("dl"),
      up_rate_limit: qbitLimit("up"),
      connection_status: "connected",
    }),
  )
  app.get("/api/v2/transfer/speedLimitsMode", (_req, res) => res.send(qbit.alt ? "1" : "0"))
  app.post("/api/v2/transfer/setSpeedLimitsMode", (req, res) => {
    qbit.alt = req.body.mode === "1"
    res.send("")
  })
  app.get("/api/v2/torrents/info", (_req, res) => res.json(demand.qbit > 0 ? [{ state: "downloading" }] : []))

  return serve(app)
}

// A fake UniFi console: one WAN on a 100/20 Mbps plan carrying the clients' traffic plus the household's
const fakeUnifi = (): Promise<string> => {
  const app = express()
  const ok = (data: unknown[]) => ({ meta: { rc: "ok" }, data })
  const rx = () => sabSpeed() + qbitSpeed() + demand.household
  const tx = () => qbitUpSpeed() + 0.03 * sabSpeed()

  app.use((req, res, next) => (req.header("X-API-Key") === "fake-unifi-key-123456" ? next() : res.status(401).end()))
  app.get("/proxy/network/api/s/default/stat/health", (_req, res) =>
    res.json(ok([{ subsystem: "wan", status: "ok", "rx_bytes-r": rx(), "tx_bytes-r": tx(), isp_name: "Fake ISP" }])),
  )
  app.get("/proxy/network/api/s/default/stat/device-basic", (_req, res) => res.json(ok([{ mac: "aa:bb", type: "udm" }])))
  app.get("/proxy/network/api/s/default/stat/device/aa:bb", (_req, res) =>
    res.json(ok([{ mac: "aa:bb", type: "udm", wan1: { up: true, is_uplink: true, "rx_bytes-r": rx(), "tx_bytes-r": tx() } }])),
  )
  app.get("/proxy/network/v2/api/site/default/wan/enriched-configuration", (_req, res) =>
    res.json([
      {
        configuration: {
          wan_networkgroup: "WAN",
          wan_provider_capabilities: { download_kilobits_per_second: 100000, upload_kilobits_per_second: 20000 },
        },
      },
    ]),
  )
  app.get("/proxy/network/v2/api/site/default/wan/load-balancing/status", (_req, res) => res.json({ mode: "FAILOVER_ONLY" }))

  return serve(app)
}

// The clients' limits never add up to more than ISP speed minus reserve: 100 - 10 down, 20 - 3 up
const assertWithinCeiling = (when: string) => {
  const down = (sab.limit || Infinity) + (qbitLimit("dl") || Infinity)
  assert.ok(down <= M(90) + 2 * KIB, `${when}: download limits add up to ${down}`)
  const up = (qbitLimit("up") || Infinity) + 0.03 * (sab.limit || Infinity) + 0.02 * (qbitLimit("dl") || Infinity)
  assert.ok(up <= M(17) + 2 * KIB, `${when}: upload limits add up to ${up}`)
}

const mbps = (bps: number) => `${(bps / 125000).toFixed(1)} Mbps`
const describe = () =>
  `SABnzbd ${mbps(sab.limit)}, qBittorrent ${mbps(qbitLimit("dl"))} down / ${mbps(qbitLimit("up"))} up`

// Run a number of balancer passes, checking the ceiling after each
const passes = async (count: number, when: string) => {
  for (let i = 0; i < count; i++) {
    await nudgeNetworkBalancer()
    if (process.env.VERBOSE) {
      const r = await getBalancerReading()
      console.log(`    ${i + 1}: household ${mbps(r.plan.household.down)}, share ${mbps(r.plan.budget.down)}. ${describe()}`)
    }
    if ((await NetworkBalancer.findOne().lean())?.enabled) assertWithinCeiling(`${when}, pass ${i + 1}`)
  }
}

const step = (name: string) => console.log(`\n▶ ${name}`)

const run = async () => {
  const mongo = await MongoMemoryServer.create()
  await mongoose.connect(mongo.getUri())

  const [sabURL, qbitURL, unifiURL] = await Promise.all([fakeSABnzbd(), fakeqBittorrent(), fakeUnifi()])

  // qBittorrent's session timeout comes from its preferences, which Automatarr normally collects hourly
  await Data.create({})
  await Data.updateOne({}, { $set: { "qBittorrent.preferences": { web_ui_session_timeout: 3600 } } })
  await Settings.create({
    sabnzbd_URL: sabURL,
    sabnzbd_KEY: "fake",
    sabnzbd_active: true,
    qBittorrent_URL: qbitURL,
    qBittorrent_username: "admin",
    qBittorrent_password: "fake",
    qBittorrent_active: true,
    unifi_URL: unifiURL,
    unifi_KEY: "fake-unifi-key-123456",
    unifi_active: true,
  })

  await startNetworkBalancer()

  step("Observe mode works out targets without changing anything")
  demand.qbit = M(200)
  const observed = await getBalancerReading()
  assert.equal(observed.plan.capacity.down, M(100))
  assert.equal(observed.plan.capacity_source.down, "plan")
  assert.equal(sab.limit, 0, "SABnzbd untouched")
  assert.equal(qbit.prefs.dl_limit, 0, "qBittorrent untouched")
  console.log("  ✓ Capacity 100 Mbps from the UniFi plan, nothing written")

  step("Turning on takes over both clients from no limits at all")
  await enableNetworkBalancer()
  assert.equal(sab.schedlines[0][0], "0", "SABnzbd speed schedule turned off")
  assert.equal(sab.schedlines[1][0], "1", "SABnzbd pause schedule left alone")
  assert.equal(qbit.prefs.scheduler_enabled, false)
  assert.equal(qbit.prefs.limit_utp_rate, true)
  assert.ok(Number(qbit.prefs.alt_up_limit) > 0, "alternative upload limit no longer unlimited")
  assert.equal(sab.bandwidth_perc, 100)
  assertWithinCeiling("after takeover")
  console.log(`  ✓ ${describe()}`)

  step("Only qBittorrent downloading: it gets nearly everything")
  await passes(6, "qBittorrent busy")
  assert.ok(qbitLimit("dl") > M(80), describe())
  assert.ok(sab.limit < M(5), describe())
  console.log(`  ✓ ${describe()}`)

  step("SABnzbd starts too: they share")
  demand.sab = M(200)
  await passes(8, "both busy")
  assert.ok(Math.abs(sab.limit - qbitLimit("dl")) < M(10), describe())
  console.log(`  ✓ ${describe()}`)

  step("Household traffic appears: the clients back off")
  demand.household = M(40)
  await passes(3, "household busy")
  assert.ok(sab.limit + qbitLimit("dl") < M(58), describe())
  console.log(`  ✓ ${describe()}`)

  step("Household traffic goes: the clients take it back slowly")
  demand.household = 0
  await passes(15, "household quiet")
  assert.ok(sab.limit + qbitLimit("dl") > M(80), describe())
  console.log(`  ✓ ${describe()}`)

  step("Someone switches on qBittorrent's alternative limits: switched back off")
  qbit.alt = true
  await passes(1, "alt mode")
  assert.equal(qbit.alt, false)
  console.log(`  ✓ ${describe()}`)

  step("Someone raises SABnzbd's limit in SABnzbd: set back")
  sab.limit = M(500)
  await passes(1, "SABnzbd raised")
  assert.ok(sab.limit < M(90), describe())
  console.log(`  ✓ ${describe()}`)

  step("The settings change: a 60 Mbps cap on qBittorrent")
  demand.sab = 0
  await updateNetworkBalancerConfig({
    capacity_down: null,
    capacity_up: null,
    reserve_down: null,
    reserve_up: null,
    overhead_pct: null,
    caps: [{ name: "qbittorrent", down: M(60), up: null }],
  })
  await passes(4, "qBittorrent capped")
  assert.ok(qbitLimit("dl") <= M(60) + KIB, describe())
  console.log(`  ✓ ${describe()}`)

  step("Shutdown leaves both clients on the fixed split")
  await runShutdownHooks(6000)
  assert.ok(Math.abs(sab.limit - qbitLimit("dl")) < M(25), describe())
  assertWithinCeiling("after shutdown")
  assert.ok((await NetworkBalancer.findOne().lean())?.enabled, "still on for the next boot")
  console.log(`  ✓ ${describe()}`)
}

// The shutdown hook stops the timer, so the rest runs in a fresh "boot" with the balancer resumed
const afterRestart = async () => {
  step("SABnzbd disappears: the balancer turns itself off after three failed passes")
  sab.up = false
  await passes(3, "SABnzbd down")
  const doc = await NetworkBalancer.findOne().lean()
  assert.equal(doc?.enabled, false)
  assert.match(String(doc?.disabled_reason), /SABnzbd stopped responding/)
  assert.ok(doc?.downloaders.find((d) => d.name === "sabnzbd")?.pending_restore)
  console.log(`  ✓ Turned off: ${doc?.disabled_reason}`)

  step("SABnzbd comes back: it's put on its fixed split")
  sab.up = true
  await nudgeNetworkBalancer()
  const after = await NetworkBalancer.findOne().lean()
  assert.ok(!after?.downloaders.some((d) => d.pending_restore), "nothing left to restore")
  assertWithinCeiling("after restore")
  console.log(`  ✓ ${describe()}`)

  step("Turning on again and off by hand")
  await enableNetworkBalancer()
  await passes(2, "re-enabled")
  await disableNetworkBalancer()
  assert.equal((await NetworkBalancer.findOne().lean())?.disabled_reason, null)
  console.log(`  ✓ ${describe()}`)
}

run()
  .then(afterRestart)
  .then(() => {
    console.log("\nEnd-to-end checks passed.")
    process.exit(0)
  })
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
