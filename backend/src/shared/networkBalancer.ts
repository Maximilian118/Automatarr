import moment from "moment"
import logger from "../logger"
import Settings, { settingsType } from "../models/settings"
import NetworkBalancer, { BalancerDownloaderType, NetworkBalancerType } from "../models/networkBalancer"
import {
  BalancerConfig,
  BalancerHistory,
  BalancerPlan,
  DownloaderAdapter,
  DownloaderLimits,
  DownloaderName,
  DownloaderState,
  NetworkEvent,
  NetworkSample,
  Pair,
  PlanInputs,
} from "../types/networkBalancerTypes"
import { UnifiSnapshot } from "../types/unifiTypes"
import {
  baselineChanges,
  capFor,
  computePlan,
  describeRate,
  FAIL_GRACE_TICKS,
  INCREASE_COOLDOWN_TICKS,
  peakSpeeds,
  KIB,
  OWNERSHIP_CHECK_TICKS,
  planChanges,
  RESTORE_MS,
  SPEED_SAMPLES,
  TICK_MS,
} from "./networkBalancerMath"
import { ApplyDeps, ApplyResult, applyChanges } from "./networkBalancerApply"
import { BALANCER_DOWNLOADERS, connectedAdapters, downloaderLabel, managedAdapters } from "./networkBalancerClients"
import { getUnifiSnapshot } from "./unifiRequests"
import { registerShutdownHook } from "./shutdownHooks"

// The network balancer shares one download budget between the download clients. Every 10 seconds it reads the
// WAN traffic from UniFi and each client's speed, then gives the clients that are downloading most of the budget.
//
// Safety: the clients' limits never add up to more than the ISP speed minus the reserve, even part way through a
// change, so if Automatarr stops at any moment the network can't be saturated. Limits are lowered before others
// are raised, and a raise is saved to the database before it's sent. See networkBalancerApply.ts.

const OBSERVE_STALE_MS = 8000 // How old a reading can be before the Network page triggers a new one
const HISTORY_LENGTH = 180 // Chart samples kept in memory, 30 minutes at one per tick
const EVENTS_LENGTH = 30 // Events kept in memory for the Network page

// Everything read in one pass, and the decision made from it
export type BalancerReading = {
  at: number
  settings: settingsType
  doc: NetworkBalancerType
  adapters: DownloaderAdapter[]
  states: Map<DownloaderName, DownloaderState>
  errors: Map<DownloaderName, string>
  snapshot: UnifiSnapshot | null
  unifi_error: string | null
  inputs: PlanInputs
  plan: BalancerPlan
}

let timer: NodeJS.Timeout | null = null
let lock: Promise<unknown> = Promise.resolve()
let shuttingDown = false
let tickCount = 0
let latest: BalancerReading | null = null
const freshHistory = (): BalancerHistory => ({
  household: { down: null, up: null },
  household_raw: { down: null, up: null },
  budget: { down: null, up: null },
})

let previous = freshHistory()

const failCounts = new Map<DownloaderName, number>()
const speedSamples = new Map<DownloaderName, Pair<number>[]>()
const lastIncreaseTick = new Map<DownloaderName, number>()
const expected = new Map<DownloaderName, DownloaderLimits>() // What the balancer last set, to notice outside changes
const upper = new Map<DownloaderName, Pair<number>>()
const confirmed = new Map<DownloaderName, DownloaderLimits>()
const history: NetworkSample[] = []
const events: NetworkEvent[] = []

// Run work one at a time, so ticks, turning on and off, and shutdown never overlap
const withLock = <T>(work: () => Promise<T>): Promise<T> => {
  const run = lock.then(work, work)
  lock = run.catch(() => undefined)
  return run
}

// Record something the balancer did for the log and the Network page
const note = (level: NetworkEvent["level"], message: string): void => {
  events.unshift({ at: moment().format(), level, message })
  events.length = Math.min(events.length, EVENTS_LENGTH)
  logger[level](`Network Balancer | ${message}`)
}

// Infinity can't be stored, so "unknown or no limit" is saved as null
const toDb = (value: number): number | null => (Number.isFinite(value) ? value : null)
const fromDb = (value: number | null | undefined): number => value ?? Infinity

// The balancer document, created with defaults the first time
const getDoc = async (): Promise<NetworkBalancerType> =>
  (await NetworkBalancer.findOneAndUpdate(
    {},
    { $setOnInsert: { updated_at: moment().format() } },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  ).lean()) as NetworkBalancerType

// Change some fields of the balancer document
const setDoc = async (update: Partial<NetworkBalancerType>): Promise<void> => {
  await NetworkBalancer.updateOne({}, { $set: { ...update, updated_at: moment().format() } })
}

// Save one client's limit bounds. Returns false if the database couldn't be written
const persistUpper = async (name: DownloaderName, bounds: Pair<number>): Promise<boolean> => {
  try {
    const values = { upper_down: toDb(bounds.down), upper_up: toDb(bounds.up) }
    const res = await NetworkBalancer.updateOne(
      { "downloaders.name": name },
      { $set: { "downloaders.$.upper_down": values.upper_down, "downloaders.$.upper_up": values.upper_up } },
    )

    if (res.matchedCount === 0) {
      await NetworkBalancer.updateOne({}, { $push: { downloaders: { name, ...values, pending_restore: false } } })
    }

    return true
  } catch (err) {
    logger.error(`Network Balancer | Couldn't save the limit bound for ${downloaderLabel(name)}: ${err}`)
    return false
  }
}

// The pieces the apply step needs
const applyDeps = (adapters: DownloaderAdapter[]): ApplyDeps => ({ adapters, upper, confirmed, persistUpper })

// Record a client's confirmed limits as its new bound, saving the bound only when it changed
const recordConfirmed = async (name: DownloaderName, limits: DownloaderLimits): Promise<void> => {
  confirmed.set(name, limits)
  const bounds = { down: limits.down, up: limits.up ?? 0 }
  const old = upper.get(name)
  upper.set(name, bounds)
  if (!old || old.down !== bounds.down || old.up !== bounds.up) await persistUpper(name, bounds)
}

// Read UniFi and every client, then work out what the limits should be
const read = async (doc: NetworkBalancerType, settings: settingsType, adapters: DownloaderAdapter[]) => {
  const [unifi, ...results] = await Promise.allSettled([
    settings.unifi_active ? getUnifiSnapshot(settings) : Promise.reject(new Error("UniFi isn't connected.")),
    ...adapters.map((a) => a.readState()),
  ])

  const states = new Map<DownloaderName, DownloaderState>()
  const errors = new Map<DownloaderName, string>()

  adapters.forEach((adapter, i) => {
    const result = results[i]
    if (result.status === "rejected") {
      errors.set(adapter.name, String(result.reason?.message ?? result.reason))
      return
    }

    states.set(adapter.name, result.value)
    const samples = [...(speedSamples.get(adapter.name) ?? []), result.value.speed].slice(-SPEED_SAMPLES)
    speedSamples.set(adapter.name, samples)
  })

  const snapshot = unifi.status === "fulfilled" ? unifi.value : null
  const config = doc.config as BalancerConfig

  const inputs: PlanInputs = {
    config: { ...config, caps: config.caps ?? [] },
    snapshot,
    last_capacity: { down: doc.last_capacity_down, up: doc.last_capacity_up },
    previous,
    // A client that can't be read counts as idle at its last bound, so it keeps its share of the fixed split
    downloaders: adapters.map((a) => {
      const state = states.get(a.name)
      const bound = upper.get(a.name)

      return {
        name: a.name,
        supports_upload: a.supports_upload,
        ack_ratio: a.ack_ratio,
        active: state?.active ?? false,
        speed: state?.speed ?? { down: 0, up: 0 },
        peak: state ? peakSpeeds(speedSamples.get(a.name) ?? []) : { down: 0, up: 0 },
        limits: state?.limits ?? { down: bound?.down ?? Infinity, up: a.supports_upload ? bound?.up ?? Infinity : null },
        cap: capFor(config, a.name),
      }
    }),
  }

  const plan = computePlan(inputs)

  if (plan.ready) previous = { household: plan.household, household_raw: plan.household_raw, budget: plan.budget }

  const reading: BalancerReading = {
    at: Date.now(),
    settings,
    doc,
    adapters,
    states,
    errors,
    snapshot,
    unifi_error: unifi.status === "rejected" ? String(unifi.reason?.message ?? unifi.reason) : null,
    inputs,
    plan,
  }

  latest = reading
  return reading
}

// Add a point to the live chart
const recordSample = (reading: BalancerReading): void => {
  history.push({
    at: moment(reading.at).format(),
    wan_down: reading.plan.wan.down,
    wan_up: reading.plan.wan.up,
    household_down: reading.plan.household.down,
    budget_down: reading.plan.budget.down,
    downloaders: [...reading.states.entries()].map(([name, state]) => ({
      name,
      down: state.speed.down,
      up: state.speed.up,
    })),
  })

  if (history.length > HISTORY_LENGTH) history.splice(0, history.length - HISTORY_LENGTH)
}

// Note anything that went wrong while changing limits
const noteResult = (result: ApplyResult): void => {
  result.errors.forEach((e) => note("error", e))

  for (const change of result.changed) {
    const label = downloaderLabel(change.name)
    const direction = change.dir === "down" ? "download" : "upload"
    logger.debug(`Network Balancer | ${label} ${direction} ${describeRate(change.from)} → ${describeRate(change.to)}`)
  }
}

// Why the balancer can't keep running with the current connections. Null when everything's fine
const connectionProblem = (doc: NetworkBalancerType, settings: settingsType): string | null => {
  if (!settings.unifi_active) return "UniFi was disconnected on the Connections page."

  for (const managed of doc.downloaders) {
    const definition = BALANCER_DOWNLOADERS.find((d) => d.name === managed.name)
    if (!definition) continue
    if (!definition.connected(settings)) return `${definition.label} was disconnected on the Connections page.`
    if (definition.url(settings) !== managed.url) return `${definition.label}'s connection details changed.`
  }

  return null
}

// Notice limits changed in a client's own settings since the balancer last set them
const noteOutsideChanges = (reading: BalancerReading): void => {
  for (const [name, state] of reading.states) {
    const last = expected.get(name)
    if (!last) continue

    const moved = Math.abs(last.down - state.limits.down) > KIB || Math.abs((last.up ?? 0) - (state.limits.up ?? 0)) > KIB
    if (moved && Number.isFinite(last.down)) {
      note("warn", `${downloaderLabel(name)}'s limit was changed outside Automatarr. Setting it back.`)
    }
  }
}

// Turn off anything in the clients that would change their limits behind the balancer's back
const enforceOwnership = async (reading: BalancerReading, adapters: DownloaderAdapter[]): Promise<string[]> => {
  const changes: string[] = []

  for (const adapter of adapters) {
    try {
      const made = await adapter.enforceOwnership(reading.plan.floors)
      changes.push(...made)
      if (made.length > 0) await recordConfirmed(adapter.name, await adapter.readLimits())
    } catch (err) {
      note("error", `${adapter.label}: couldn't check its speed settings. ${err}`)
    }
  }

  return changes
}

// One balancing pass: read everything, then move the limits towards the targets
const tick = async (): Promise<void> => {
  tickCount++

  const [doc, settings] = await Promise.all([getDoc(), Settings.findOne().lean<settingsType>()])
  if (!doc.enabled || !settings) return

  const problem = connectionProblem(doc, settings)
  if (problem) return disable(problem)

  const adapters = managedAdapters(settings, doc.downloaders)
  const reading = await read(doc, settings, adapters)

  for (const adapter of adapters) {
    const failed = reading.errors.has(adapter.name)
    failCounts.set(adapter.name, failed ? (failCounts.get(adapter.name) ?? 0) + 1 : 0)

    if ((failCounts.get(adapter.name) ?? 0) >= FAIL_GRACE_TICKS) {
      return disable(`${adapter.label} stopped responding: ${reading.errors.get(adapter.name)}`)
    }
  }

  noteOutsideChanges(reading)
  for (const [name, state] of reading.states) await recordConfirmed(name, state.limits)

  const reachable = adapters.filter((a) => reading.states.has(a.name))
  const altModeOn = [...reading.states.values()].some((s) => s.alt_mode)

  if (altModeOn || tickCount % OWNERSHIP_CHECK_TICKS === 0) {
    const changes = await enforceOwnership(reading, reachable)
    changes.forEach((c) => note("warn", `${c} It had been turned back on.`))
  }

  recordSample(reading)

  // The active WAN's speed isn't known any more, e.g. after failing over to a backup line with no plan set in UniFi
  if (!reading.plan.ready) {
    return disable("The ISP speed of the WAN in use isn't known. Set its plan speeds in UniFi or enter them on the Network page.")
  }

  // While any client can't be read, nothing is raised. Its last bound still counts against the budget
  const allReachable = reachable.length === adapters.length
  const plan = planChanges(
    reading.plan.targets,
    new Map(reachable.map((a) => [a.name, confirmed.get(a.name) as DownloaderLimits])),
    reading.plan.budget,
    reading.plan.capacity,
    (name) => allReachable && tickCount - (lastIncreaseTick.get(name) ?? -Infinity) >= INCREASE_COOLDOWN_TICKS,
  )

  const result = await applyChanges(applyDeps(adapters), plan, reading.plan.budget)
  noteResult(result)
  result.changed.filter((c) => c.to > c.from).forEach((c) => lastIncreaseTick.set(c.name, tickCount))
  for (const adapter of reachable) expected.set(adapter.name, confirmed.get(adapter.name) as DownloaderLimits)

  if (reading.plan.capacity.down !== doc.last_capacity_down || reading.plan.capacity.up !== doc.last_capacity_up) {
    await setDoc({ last_capacity_down: reading.plan.capacity.down, last_capacity_up: reading.plan.capacity.up })
  }
}

// Move every managed client to its fixed, safe limits. Clients that can't be reached or can't be raised yet are
// marked so the restore loop tries again. Returns true when every client got there.
const restoreBaseline = async (markPending: boolean): Promise<boolean> => {
  const [doc, settings] = await Promise.all([getDoc(), Settings.findOne().lean<settingsType>()])
  if (!settings || doc.downloaders.length === 0) return true

  const adapters = managedAdapters(settings, doc.downloaders)
  const reading = await read(doc, settings, adapters)

  // Without a current ISP speed, the fixed split falls back to the last known one
  const plan = reading.plan.ready ? reading.plan : computePlan({ ...reading.inputs, snapshot: null })

  if (!plan.ready) {
    note("error", "Couldn't work out the fixed limits because the ISP speed isn't known. Limits left as they are.")
    return false
  }

  for (const [name, state] of reading.states) await recordConfirmed(name, state.limits)

  const reachable = adapters.filter((a) => reading.states.has(a.name))
  const baseline = plan.baseline.filter((b) => reachable.some((a) => a.name === b.name))
  const result = await applyChanges(applyDeps(adapters), baselineChanges(baseline, confirmed), plan.base_hard)
  noteResult(result)

  // A client is done once it was reached and nothing it needed was held back or failed
  const done = (d: BalancerDownloaderType) =>
    reachable.some((a) => a.name === d.name) &&
    !result.held.some((c) => c.name === d.name) &&
    !result.errors.some((e) => e.startsWith(downloaderLabel(d.name)))

  // Clients at a different URL now can't be restored. The old instance keeps its last limits
  const stillManaged = (d: BalancerDownloaderType) => adapters.some((a) => a.name === d.name)
  doc.downloaders
    .filter((d) => !stillManaged(d))
    .forEach((d) => note("warn", `${downloaderLabel(d.name)} moved, so the old instance keeps its last limits.`))

  if (markPending) {
    const downloaders = doc.downloaders
      .filter(stillManaged)
      .map((d) => ({ ...d, pending_restore: !done(d) }))
    await setDoc({ downloaders })

    downloaders
      .filter((d) => d.pending_restore && !d.url)
      .forEach((d) => note("warn", `${downloaderLabel(d.name)} has no URL, so it can't be given its fixed limits.`))
  }

  return doc.downloaders.filter(stillManaged).every(done)
}

// Turn the balancer off and leave every client with its fixed, safe limits. reason is set when it turned itself off
const disable = async (reason: string | null): Promise<void> => {
  await setDoc({ enabled: false, disabled_reason: reason, disabled_at: moment().format() })
  note(reason ? "warn" : "info", reason ? `Turned itself off. ${reason}` : "Turned off.")

  const restored = await restoreBaseline(true)
  if (restored) note("info", "Every download client is back on its fixed limits.")
}

// The work for one timer run. Returns how long to wait before the next run, or null to stop
const runCycle = async (): Promise<number | null> => {
  const doc = await getDoc()

  if (doc.enabled) {
    await tick()
    return TICK_MS
  }

  if (doc.downloaders.some((d) => d.pending_restore)) {
    const restored = await restoreBaseline(true)
    if (restored) note("info", "Every download client is back on its fixed limits.")
    return restored ? null : RESTORE_MS
  }

  return null
}

// Run the next cycle after a delay, replacing any run that's already scheduled
const schedule = (delayMs: number): void => {
  if (timer) clearTimeout(timer)
  if (shuttingDown) return

  timer = setTimeout(() => {
    timer = null
    withLock(runCycle)
      .catch((err) => {
        logger.error(`Network Balancer | Pass failed: ${err}`)
        return TICK_MS
      })
      .then((next) => {
        if (next !== null) schedule(next)
      })
  }, delayMs)
}

// Forget everything learned while running, so a fresh start doesn't act on stale readings
const resetRunState = (): void => {
  tickCount = 0
  failCounts.clear()
  lastIncreaseTick.clear()
  expected.clear()
  previous = freshHistory()
}

// Everything stopping the balancer from being turned on right now. Empty = it can be turned on
export const balancerBlockers = (reading: BalancerReading): string[] => {
  const blockers: string[] = []
  const { settings } = reading

  for (const definition of BALANCER_DOWNLOADERS) {
    if (!definition.connected(settings)) blockers.push(`${definition.label} isn't connected on the Connections page.`)
  }

  if (!settings.unifi_active) {
    blockers.push("UniFi isn't connected on the Connections page.")
  } else if (reading.unifi_error) {
    blockers.push(`UniFi can't be reached: ${reading.unifi_error}`)
  }

  for (const [name, error] of reading.errors) blockers.push(`${downloaderLabel(name)} can't be reached: ${error}`)

  if (reading.adapters.length < 2) blockers.push("At least two download clients are needed to share bandwidth.")

  if (!reading.plan.ready) {
    blockers.push(
      "Automatarr doesn't know your ISP speed yet. Set your plan's speeds in UniFi (Settings > Internet > your WAN) or enter them below.",
    )
  }

  return blockers
}

// Take over the clients and start balancing. Throws with the reasons if it can't be turned on
export const enableNetworkBalancer = (): Promise<void> =>
  withLock(async () => {
    const [doc, settings] = await Promise.all([getDoc(), Settings.findOne().lean<settingsType>()])
    if (!settings) throw new Error("No settings found.")
    if (doc.enabled && !doc.takeover_in_progress) return

    const adapters = connectedAdapters(settings)
    const reading = await read(doc, settings, adapters)
    const blockers = balancerBlockers(reading)
    if (blockers.length > 0) throw new Error(blockers.join(" "))

    try {
      // Keep the first snapshot if a takeover was interrupted, so it still shows the user's original settings
      const snapshots = await Promise.all(
        adapters.map(async (a) => {
          const kept = doc.takeover_in_progress ? doc.downloaders.find((d) => d.name === a.name)?.snapshot : undefined
          return kept ?? (await a.snapshot())
        }),
      )

      await setDoc({
        takeover_in_progress: true,
        takeover_at: moment().format(),
        downloaders: adapters.map((a, i) => ({
          name: a.name,
          url: a.url,
          upper_down: toDb(upper.get(a.name)?.down ?? Infinity),
          upper_up: toDb(upper.get(a.name)?.up ?? Infinity),
          pending_restore: false,
          snapshot: snapshots[i],
        })),
      })

      for (const [name, state] of reading.states) await recordConfirmed(name, state.limits)
      const changes = await enforceOwnership(reading, adapters)

      const result = await applyChanges(
        applyDeps(adapters),
        baselineChanges(reading.plan.baseline, confirmed),
        reading.plan.base_hard,
      )
      if (result.errors.length > 0) throw new Error(result.errors.join(" "))

      resetRunState()
      await setDoc({
        enabled: true,
        enabled_at: moment().format(),
        disabled_reason: null,
        disabled_at: null,
        takeover_in_progress: false,
        changes: [...(doc.takeover_in_progress ? doc.changes : []), ...changes],
        last_capacity_down: reading.plan.capacity.down,
        last_capacity_up: reading.plan.capacity.up,
      })

      latest = null
      changes.forEach((c) => note("info", c))
      note("info", `Turned on. Sharing ${describeRate(reading.plan.hard.down)} between ${adapters.length} download clients.`)
      schedule(TICK_MS)
    } catch (err) {
      await setDoc({ takeover_in_progress: false })
      await disable(`Couldn't take over the download clients: ${err instanceof Error ? err.message : err}`)
      schedule(RESTORE_MS)
      throw err
    }
  })

// Turn the balancer off at the user's request
export const disableNetworkBalancer = (): Promise<void> =>
  withLock(async () => {
    const doc = await getDoc()
    if (!doc.enabled) return
    await disable(null)
    latest = null
    schedule(RESTORE_MS)
  })

// Run a pass now instead of waiting for the next one, e.g. after the settings change
export const nudgeNetworkBalancer = (): Promise<void> => withLock(runCycle).then(() => undefined)

// Save the Network page's settings and run a pass straight away so they take effect
export const updateNetworkBalancerConfig = async (config: BalancerConfig): Promise<void> => {
  await setDoc({ config })
  latest = null
  if ((await getDoc()).enabled) await nudgeNetworkBalancer()
}

// Get the latest reading for the Network page. While the balancer is off, a fresh reading is taken if the
// last one is stale, so the page shows what the balancer would do. While it's on, the last tick is used.
export const getBalancerReading = async (): Promise<BalancerReading> => {
  const doc = await getDoc()
  const fresh = latest && Date.now() - latest.at < (doc.enabled ? TICK_MS * 3 : OBSERVE_STALE_MS)

  if (fresh && latest) return { ...latest, doc }

  return withLock(async () => {
    const settings = await Settings.findOne().lean<settingsType>()
    if (!settings) throw new Error("No settings found.")

    const adapters = doc.enabled ? managedAdapters(settings, doc.downloaders) : connectedAdapters(settings)
    const reading = await read(doc, settings, adapters)
    if (!doc.enabled) recordSample(reading)
    return reading
  })
}

// The chart samples and recent events for the Network page
export const getBalancerHistory = (): { history: NetworkSample[]; events: NetworkEvent[] } => ({
  history,
  events,
})

// The bounds the balancer is holding for each client, for the Network page
export const getBalancerBounds = (): Map<DownloaderName, Pair<number>> => upper

// Start the balancer at boot. Resumes balancing, finishes an interrupted takeover, or retries clients that
// still need their fixed limits.
export const startNetworkBalancer = async (): Promise<void> => {
  const doc = await getDoc()

  for (const d of doc.downloaders) upper.set(d.name, { down: fromDb(d.upper_down), up: fromDb(d.upper_up) })

  registerShutdownHook("Network Balancer", stopNetworkBalancer)

  // A takeover that can't be finished, e.g. because a client isn't up yet, falls back to the fixed split
  if (doc.takeover_in_progress) {
    note("warn", "Taking over the download clients was interrupted. Finishing it now.")
    enableNetworkBalancer().catch(async (err) => {
      if (!(await getDoc()).takeover_in_progress) return

      await withLock(async () => {
        await setDoc({ takeover_in_progress: false })
        await disable(`Couldn't finish taking over the download clients: ${err instanceof Error ? err.message : err}`)
      })
      schedule(RESTORE_MS)
    })
    return
  }

  if (doc.enabled) {
    note("info", "Resuming.")
    schedule(TICK_MS / 2)
  } else if (doc.downloaders.some((d) => d.pending_restore)) {
    schedule(RESTORE_MS)
  }
}

// Leave every client on its fixed limits before Automatarr exits. The balancer stays on, so it picks up again
// at the next boot. Its safety doesn't depend on this running: the limits always fit the budget.
const stopNetworkBalancer = async (): Promise<void> => {
  shuttingDown = true
  if (timer) clearTimeout(timer)

  const doc = await getDoc()
  if (!doc.enabled) return

  await withLock(() => restoreBaseline(false))
  logger.info("Network Balancer | Left the download clients on their fixed limits for shutdown.")
}
