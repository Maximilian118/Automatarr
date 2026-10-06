// Failure-injection simulator for the network balancer's apply step. Not compiled into the app (*.dev.ts).
// Runs thousands of random balancing passes against fake download clients that drop requests, lose responses,
// fail to read back and restart, while Automatarr's database writes fail and Automatarr itself restarts.
// After every limit write it checks:
// - Safety: once the clients' limits fit under the hard ceiling, no write ever takes them over it.
// - Soundness: the saved bound for each client is always at least its real limit, so a crash at any moment
//   leaves Automatarr with a safe picture of the clients.
//
// Usage: npx ts-node -T networkBalancerSim.dev.ts [passes] [seed]

import assert from "node:assert/strict"
import { ApplyDeps, applyChanges } from "./src/shared/networkBalancerApply"
import { floorToKiB, KIB, mbpsToBps, planChanges, sum, waterFill } from "./src/shared/networkBalancerMath"
import { DownloaderAdapter, DownloaderLimits, DownloaderName, Pair } from "./src/types/networkBalancerTypes"

const PASSES = Number(process.argv[2]) || 20000
let seed = Number(process.argv[3]) || 42

// A small seeded random number generator, so a failure can be replayed with the same seed
const random = (): number => {
  seed = (seed * 1664525 + 1013904223) % 4294967296
  return seed / 4294967296
}

const CAPACITY = { down: mbpsToBps(100), up: mbpsToBps(20) }
const HARD = { down: mbpsToBps(90), up: mbpsToBps(17) }

// A fake download client whose real limits start unlimited, as they would before takeover
type FakeClient = { name: DownloaderName; ack: number; uploads: boolean; actual: DownloaderLimits; reachable: boolean }

const clients: FakeClient[] = [
  { name: "sabnzbd", ack: 0.03, uploads: false, actual: { down: Infinity, up: null }, reachable: true },
  { name: "qbittorrent", ack: 0.02, uploads: true, actual: { down: Infinity, up: Infinity }, reachable: true },
]

const saved = new Map<DownloaderName, Pair<number>>() // What the database holds
let safe = { down: false, up: false } // Whether the clients' limits have fitted under the hard ceiling yet
let writes = 0

// Total real limits for one direction, upload including every client's acknowledgements
const total = (dir: "down" | "up"): number =>
  dir === "down"
    ? sum(clients.map((c) => c.actual.down))
    : sum(clients.map((c) => (c.uploads ? (c.actual.up as number) : 0) + c.ack * c.actual.down))

const violations: string[] = [] // Recorded rather than thrown, because the apply step catches client errors

// Check both properties after a real limit changed
const checkInvariants = (pass: number): void => {
  writes++

  for (const dir of ["down", "up"] as const) {
    const fits = total(dir) <= HARD[dir] + 2 * KIB
    if (safe[dir] && !fits) violations.push(`pass ${pass}: ${dir} went over the hard ceiling (${total(dir)} > ${HARD[dir]})`)
    if (fits) safe[dir] = true
  }

  for (const c of clients) {
    const bound = saved.get(c.name) ?? { down: Infinity, up: Infinity }
    if (bound.down < c.actual.down) violations.push(`pass ${pass}: ${c.name} saved download bound is below its real limit`)
    if (c.uploads && bound.up < (c.actual.up as number)) {
      violations.push(`pass ${pass}: ${c.name} saved upload bound is below its real limit`)
    }
  }
}

let currentPass = 0

// A fake adapter that fails at random in every way a real client can
const adapterFor = (c: FakeClient): DownloaderAdapter => ({
  name: c.name,
  label: c.name,
  supports_upload: c.uploads,
  ack_ratio: c.ack,
  url: "",
  readState: async () => {
    throw new Error("unused")
  },
  readLimits: async () => {
    if (!c.reachable || random() < 0.1) throw new Error("read failed")
    return { ...c.actual }
  },
  applyLimits: async (limits) => {
    if (!c.reachable || random() < 0.1) throw new Error("request dropped")
    if (limits.down !== undefined) c.actual.down = limits.down
    if (limits.up !== undefined && c.uploads) c.actual.up = limits.up
    checkInvariants(currentPass)
    if (random() < 0.05) throw new Error("response lost")
  },
  snapshot: async () => [],
  enforceOwnership: async () => [],
})

const adapters = clients.map(adapterFor)
let upper = new Map<DownloaderName, Pair<number>>()
const confirmed = new Map<DownloaderName, DownloaderLimits>()

const deps = (): ApplyDeps => ({
  adapters,
  upper,
  confirmed,
  persistUpper: async (name, bounds) => {
    if (random() < 0.1) return false
    saved.set(name, { ...bounds })
    return true
  },
})

// Random targets that fit the budget, like the real water-fill would make
const randomTargets = (budget: Pair<number>) => {
  const down = waterFill(
    budget.down,
    clients.map(() => ({ floor: mbpsToBps(1), want: random() < 0.5 ? Infinity : random() * budget.down, cap: Infinity, weight: 1 })),
  ).map(floorToKiB)
  const ack = sum(clients.map((c, i) => c.ack * down[i]))

  return clients.map((c, i) => ({
    name: c.name,
    down: down[i],
    up: c.uploads ? floorToKiB(Math.max(0, budget.up - ack)) : null,
    hungry: false,
  }))
}

const run = async (): Promise<void> => {
  for (let pass = 0; pass < PASSES; pass++) {
    currentPass = pass

    // Automatarr restarts: everything in memory is lost and the saved bounds are loaded again
    if (random() < 0.03) {
      upper = new Map([...saved.entries()].map(([name, bounds]) => [name, { ...bounds }]))
      confirmed.clear()
    }

    // A client goes away or comes back
    for (const c of clients) if (random() < 0.05) c.reachable = !c.reachable

    // Read each client, as a tick does before planning
    for (const adapter of adapters) {
      try {
        const limits = await adapter.readLimits()
        confirmed.set(adapter.name, limits)
        const bounds = { down: limits.down, up: limits.up ?? 0 }
        upper.set(adapter.name, bounds)
        if (random() > 0.1) saved.set(adapter.name, bounds)
      } catch {
        confirmed.delete(adapter.name)
      }
    }

    const budget = { down: HARD.down * (0.3 + random() * 0.7), up: HARD.up * (0.3 + random() * 0.7) }
    const reachable = clients.filter((c) => confirmed.has(c.name))
    const allReachable = reachable.length === clients.length

    const plan = planChanges(
      randomTargets(budget).filter((t) => confirmed.has(t.name)),
      confirmed,
      budget,
      CAPACITY,
      () => allReachable,
    )

    await applyChanges(deps(), plan, budget)
    assert.deepEqual(violations, [], `Failed with seed ${process.argv[3] || 42}`)
  }
}

run()
  .then(() => {
    assert.ok(safe.down && safe.up, "the clients never got under the hard ceiling")
    console.log(`${PASSES} passes, ${writes} limit writes. Never over the hard ceiling, saved bounds always sound.`)
  })
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
