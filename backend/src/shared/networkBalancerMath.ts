import {
  BalancerConfig,
  BalancerPlan,
  CapacitySource,
  ChangePlan,
  Direction,
  DownloaderInput,
  DownloaderLimits,
  DownloaderName,
  DownloaderTarget,
  LimitChange,
  Pair,
  PlanInputs,
} from "../types/networkBalancerTypes"
import { UnifiSnapshot, UnifiWan } from "../types/unifiTypes"

// Pure network balancer maths. No requests or database access, so every decision can be checked in isolation.
// Every speed is bytes per second. Infinity means "no limit".

export const MBPS = 125_000 // Bytes per second in one megabit per second
export const KIB = 1024
export const MIB = 1024 * 1024

export const TICK_MS = 10_000 // How often the balancer runs
export const RESTORE_MS = 30_000 // How often a disconnected client is retried after the balancer turns off
export const FAIL_GRACE_TICKS = 3 // Failed reads in a row before the balancer turns itself off
export const OWNERSHIP_CHECK_TICKS = 6 // Ticks between checks for speed schedules turned back on
export const INCREASE_COOLDOWN_TICKS = 2 // Ticks a client waits between limit increases
export const HUNGRY_RATIO = 0.85 // A client using this share of its limit could go faster
export const HEADROOM = 1.25 // Room given above what a client that isn't hungry is using
export const DEFAULT_OVERHEAD_PCT = 5 // Protocol overhead on top of what the clients report
export const HOUSEHOLD_FALL = 0.15 // How quickly the household estimate follows a fall
export const BUDGET_GROWTH = 0.05 // The most the budget grows per tick, as a share of capacity
export const SPEED_SAMPLES = 2 // Readings a client's peak speed is taken from

const DIRECTIONS: Direction[] = ["down", "up"]

// Convert between bytes per second and the units people and UniFi use
export const mbpsToBps = (mbps: number): number => mbps * MBPS
export const bpsToMbps = (bps: number): number => bps / MBPS
export const kbitsToBps = (kbits: number): number => kbits * 125

// Describe a speed for logs and the Network page, e.g. "94.0 Mbps"
export const describeRate = (bps: number | null): string => {
  if (bps === null) return "not set"
  if (!Number.isFinite(bps) || bps <= 0) return "no limit"
  return `${bpsToMbps(bps).toFixed(1)} Mbps`
}

// Clamp a number between a minimum and a maximum
export const clamp = (value: number, min: number, max: number): number =>
  Math.min(Math.max(value, min), max)

// Round a limit down to whole KiB, never below 1 KiB. qBittorrent stores limits in KiB and 0 means
// "no limit" to both clients, so rounding down and never sending 0 keeps every limit at or under target.
export const floorToKiB = (bps: number): number => Math.max(KIB, Math.floor(bps / KIB) * KIB)

// Add up a list of numbers
export const sum = (values: number[]): number => values.reduce((total, v) => total + v, 0)

// The download or upload value of a pair
export const pick = <T>(pair: Pair<T>, dir: Direction): T => (dir === "down" ? pair.down : pair.up)

// Reserve Automatarr recommends keeping free: 10% of download (5-50 Mbps) and 15% of upload (2-20 Mbps),
// never more than half the line
export const recommendReserve = (capacity: number, dir: Direction): number => {
  const reserve =
    dir === "down"
      ? clamp(capacity * 0.1, mbpsToBps(5), mbpsToBps(50))
      : clamp(capacity * 0.15, mbpsToBps(2), mbpsToBps(20))

  return Math.min(reserve, capacity * 0.5)
}

// The least a client is given: 1% of download (at least 256 KiB/s) or 5% of upload (at least 128 KiB/s)
export const floorFor = (capacity: number, dir: Direction): number =>
  dir === "down" ? Math.max(capacity * 0.01, 256 * KIB) : Math.max(capacity * 0.05, 128 * KIB)

// Extra room given to a client that isn't using all of its limit
export const marginFor = (capacity: number): number => Math.max(capacity * 0.02, MIB)

// The smallest change worth sending to a client, so limits aren't rewritten every tick
export const hysteresisFor = (current: number, capacity: number): number =>
  Math.max(Number.isFinite(current) ? current * 0.05 : 0, capacity * 0.02, 256 * KIB)

// The WANs that are up and the one carrying traffic. A gateway with no WAN marked active uses the first up WAN
const upWans = (snapshot: UnifiSnapshot): { up: UnifiWan[]; active: UnifiWan | undefined } => {
  const up = snapshot.wans.filter((w) => w.up)
  return { up, active: up.find((w) => w.active) ?? up[0] }
}

// The ISP plan speed set in UniFi. Load-balanced WANs add up. With failover only the active WAN counts
export const planCapacity = (snapshot: UnifiSnapshot | null, dir: Direction): number | null => {
  if (!snapshot) return null

  const planOf = (w: UnifiWan) => (dir === "down" ? w.plan_down : w.plan_up)
  const { up, active } = upWans(snapshot)

  if (snapshot.mode === "distributed" && up.length > 0 && up.every((w) => planOf(w))) {
    return sum(up.map((w) => planOf(w) as number))
  }

  return active ? planOf(active) : null
}

// The slowest ISP plan across every WAN, so the fixed split stays safe after a failover
export const smallestPlan = (snapshot: UnifiSnapshot | null, dir: Direction): number | null => {
  const plans = (snapshot?.wans ?? [])
    .map((w) => (dir === "down" ? w.plan_down : w.plan_up))
    .filter((p): p is number => !!p)

  return plans.length > 0 ? Math.min(...plans) : null
}

// Pick the ISP speed: the user's figure, then the UniFi plan, then the last speedtest, then the last known value.
// The last known value is only used when UniFi can't be reached. With UniFi up, an active WAN with no plan and no
// speedtest of its own (e.g. a backup line after a failover) is unknown rather than assumed as fast as the last one.
export const selectCapacity = (
  override: number | null,
  snapshot: UnifiSnapshot | null,
  last: number | null,
  dir: Direction,
): { value: number | null; source: CapacitySource } => {
  if (override) return { value: override, source: "manual" }

  const plan = planCapacity(snapshot, dir)
  if (plan) return { value: plan, source: "plan" }

  const test = snapshot?.speedtest ? pick({ down: snapshot.speedtest.down, up: snapshot.speedtest.up }, dir) : 0
  if (test) return { value: test, source: "speedtest" }

  if (last && !snapshot) return { value: last, source: "last" }

  return { value: null, source: "none" }
}

// Live traffic across every WAN that's up
export const wanTraffic = (snapshot: UnifiSnapshot | null): Pair<number> => {
  const up = snapshot ? upWans(snapshot).up : []
  return { down: sum(up.map((w) => w.down)), up: sum(up.map((w) => w.upload)) }
}

// Traffic the download clients cause on the WAN. Upload includes the acknowledgements their downloads send
export const downloaderTraffic = (downloaders: DownloaderInput[], overheadPct: number): Pair<number> => {
  const overhead = 1 + overheadPct / 100

  return {
    down: sum(downloaders.map((d) => d.speed.down)) * overhead,
    up: sum(downloaders.map((d) => d.speed.up * overhead + d.speed.down * d.ack_ratio)),
  }
}

// Follow household traffic up as soon as two readings in a row agree, and down slowly, so the clients back off fast
// and only take bandwidth back once it has stayed free. The WAN and the clients aren't read at exactly the same
// moment, so a single reading can show traffic that isn't there while a client's speed changes. Rising only to the
// smaller of the last two readings ignores that.
export const smoothHousehold = (previous: number | null, lastRaw: number | null, raw: number): number => {
  if (previous === null) return raw
  const confirmed = Math.min(raw, lastRaw ?? raw)
  if (confirmed > previous) return confirmed
  return raw < previous ? previous + (raw - previous) * HOUSEHOLD_FALL : previous
}

// The bandwidth the clients can share this tick. It shrinks at once but grows by at most BUDGET_GROWTH
// of capacity per tick. Without UniFi it's held where it was and never grows.
export const nextBudget = (
  previous: number | null,
  hard: number,
  household: number,
  capacity: number,
  floorTotal: number,
  degraded: boolean,
): number => {
  let budget = hard - household

  if (degraded) {
    budget = previous ?? hard
  } else if (previous !== null && budget > previous) {
    budget = Math.min(budget, previous + capacity * BUDGET_GROWTH)
  }

  return clamp(budget, Math.min(floorTotal, hard), hard)
}

// The least each client is given, shrunk if the clients' floors wouldn't fit under the hard ceiling
export const floorsFor = (count: number, capacity: number, hard: number, dir: Direction): number => {
  if (count === 0) return 0
  return Math.min(floorFor(capacity, dir), hard / count)
}

// How much a client wants: the floor when idle, everything when it's using nearly all of its limit,
// otherwise a bit more than it's using
export const wantFor = (
  d: DownloaderInput,
  dir: Direction,
  floor: number,
  capacity: number,
): { want: number; hungry: boolean } => {
  if (dir === "up") return { want: Infinity, hungry: false }
  if (!d.active) return { want: floor, hungry: false }

  const hungry = d.peak.down >= HUNGRY_RATIO * d.limits.down
  if (hungry) return { want: Infinity, hungry }

  return { want: Math.max(floor, d.peak.down * HEADROOM + marginFor(capacity)), hungry }
}

// One client's share of the water-fill
export type FillEntry = { floor: number; want: number; cap: number; weight: number }

// Share what's left between the clients that are still under their limit, by weight. Returns what's left over
const share = (alloc: number[], entries: FillEntry[], remaining: number, limitOf: (e: FillEntry) => number) => {
  let open = entries.map((_, i) => i).filter((i) => alloc[i] < limitOf(entries[i]))

  while (remaining > 1 && open.length > 0) {
    const totalWeight = sum(open.map((i) => entries[i].weight))
    let given = 0

    for (const i of open) {
      const portion = (remaining * entries[i].weight) / totalWeight
      const room = limitOf(entries[i]) - alloc[i]
      const gift = Math.min(portion, room)
      alloc[i] += gift
      given += gift
    }

    remaining -= given
    open = open.filter((i) => limitOf(entries[i]) - alloc[i] > 1)
    if (given <= 1) break
  }

  return remaining
}

// Max-min fair split of a budget. Everyone gets their floor, then the rest is shared by weight up to each
// client's want, then anything left over is shared up to each client's maximum
export const waterFill = (budget: number, entries: FillEntry[]): number[] => {
  const floors = entries.map((e) => Math.min(e.floor, e.cap))
  const floorTotal = sum(floors)

  if (floorTotal >= budget) {
    return floors.map((f) => (floorTotal > 0 ? (budget * f) / floorTotal : 0))
  }

  const alloc = [...floors]
  const remaining = share(alloc, entries, budget - floorTotal, (e) => Math.min(e.want, e.cap))
  share(alloc, entries, remaining, (e) => e.cap)

  return alloc
}

// Upload the clients can't limit: the acknowledgements every download sends
export const ackTraffic = (
  downloaders: { name: DownloaderName; ack_ratio: number }[],
  downLimits: Map<DownloaderName, number>,
): number => sum(downloaders.map((d) => d.ack_ratio * (downLimits.get(d.name) ?? 0)))

// Split the download budget, then share the upload budget left after acknowledgements between the clients
// that can limit upload
export const splitBudget = (
  downloaders: DownloaderInput[],
  budget: Pair<number>,
  floors: Pair<number>,
  capacity: Pair<number>,
  everyoneWants: boolean,
): DownloaderTarget[] => {
  const wants = downloaders.map((d) =>
    everyoneWants ? { want: Infinity, hungry: false } : wantFor(d, "down", floors.down, capacity.down),
  )

  const down = waterFill(
    budget.down,
    downloaders.map((d, i) => ({ floor: floors.down, want: wants[i].want, cap: d.cap.down, weight: 1 })),
  ).map(floorToKiB)

  const downByName = new Map(downloaders.map((d, i) => [d.name, down[i]]))
  const uploaders = downloaders.filter((d) => d.supports_upload)
  const upBudget = Math.max(0, budget.up - ackTraffic(downloaders, downByName))

  const up = waterFill(
    upBudget,
    uploaders.map((d) => ({ floor: floors.up, want: Infinity, cap: d.cap.up, weight: 1 })),
  ).map(floorToKiB)

  const upByName = new Map(uploaders.map((d, i) => [d.name, up[i]]))

  return downloaders.map((d, i) => ({
    name: d.name,
    down: down[i],
    up: upByName.get(d.name) ?? null,
    hungry: wants[i].hungry,
  }))
}

// Work out one balancing decision from the latest network and client readings
export const computePlan = (inputs: PlanInputs): BalancerPlan => {
  const { config, snapshot, downloaders } = inputs
  const overhead = config.overhead_pct ?? DEFAULT_OVERHEAD_PCT
  const degraded = !snapshot

  const pairOf = <T>(fn: (dir: Direction) => T): Pair<T> => ({ down: fn("down"), up: fn("up") })
  const overrideFor = (dir: Direction) => (dir === "down" ? config.capacity_down : config.capacity_up)
  const reserveFor = (dir: Direction) => (dir === "down" ? config.reserve_down : config.reserve_up)

  const selected = pairOf((dir) => selectCapacity(overrideFor(dir), snapshot, pick(inputs.last_capacity, dir), dir))
  const auto = pairOf((dir) => selectCapacity(null, snapshot, pick(inputs.last_capacity, dir), dir).value)
  const capacity = pairOf((dir) => pick(selected, dir).value ?? 0)
  const ready = capacity.down > 0 && capacity.up > 0

  const reserve = pairOf((dir) => Math.min(reserveFor(dir) ?? recommendReserve(pick(capacity, dir), dir), pick(capacity, dir)))
  const hard = pairOf((dir) => Math.max(0, pick(capacity, dir) - pick(reserve, dir)))
  const uploaderCount = downloaders.filter((d) => d.supports_upload).length
  const floors = {
    down: floorsFor(downloaders.length, capacity.down, hard.down, "down"),
    up: floorsFor(uploaderCount, capacity.up, hard.up, "up"),
  }

  const wan = wanTraffic(snapshot)
  const own = downloaderTraffic(downloaders, overhead)
  const householdRaw = pairOf((dir) => Math.max(0, pick(wan, dir) - pick(own, dir)))
  const household = pairOf((dir) =>
    degraded
      ? pick(inputs.previous.household, dir) ?? 0
      : smoothHousehold(pick(inputs.previous.household, dir), pick(inputs.previous.household_raw, dir), pick(householdRaw, dir)),
  )

  const floorTotal = { down: floors.down * downloaders.length, up: floors.up * uploaderCount }
  const budget = pairOf((dir) =>
    nextBudget(
      pick(inputs.previous.budget, dir),
      pick(hard, dir),
      pick(household, dir),
      pick(capacity, dir),
      pick(floorTotal, dir),
      degraded,
    ),
  )

  // The fixed split is sized for the slowest WAN, so it stays safe even after failing over to a backup line
  const baseCapacity = pairOf((dir) =>
    overrideFor(dir) ? pick(capacity, dir) : Math.min(pick(capacity, dir), smallestPlan(snapshot, dir) ?? Infinity),
  )
  const baseHard = pairOf((dir) => Math.max(0, pick(baseCapacity, dir) - pick(reserve, dir)))

  return {
    ready,
    degraded,
    capacity,
    capacity_source: pairOf((dir) => pick(selected, dir).source),
    reserve,
    hard,
    wan,
    household,
    household_raw: householdRaw,
    budget,
    floors,
    targets: ready ? splitBudget(downloaders, budget, floors, capacity, false) : [],
    baseline: ready ? splitBudget(downloaders, baseHard, floors, capacity, true) : [],
    base_hard: baseHard,
    recommended: {
      capacity: auto,
      reserve: pairOf((dir) => {
        const c = pick(auto, dir)
        return c ? recommendReserve(c, dir) : null
      }),
      overhead_pct: DEFAULT_OVERHEAD_PCT,
    },
  }
}

// The limit changes needed to reach the targets. Small changes are skipped so limits aren't rewritten every tick,
// except that every limit above its target is lowered when the limits add up to more than the budget, or when
// anything is being raised, so the raise has the room it needs.
export const planChanges = (
  targets: DownloaderTarget[],
  current: Map<DownloaderName, DownloaderLimits>,
  budget: Pair<number>,
  capacity: Pair<number>,
  canIncrease: (name: DownloaderName) => boolean,
): ChangePlan => {
  const lower: { change: LimitChange; needed: boolean }[] = []
  const increases: LimitChange[] = []

  for (const dir of DIRECTIONS) {
    const rows = targets
      .map((t) => ({ name: t.name, dir, to: dir === "down" ? t.down : t.up, from: current.get(t.name)?.[dir] ?? null }))
      .filter((r): r is LimitChange => r.to !== null && r.from !== null)

    const over = sum(rows.map((r) => r.from)) > pick(budget, dir) + hysteresisFor(0, pick(capacity, dir))

    for (const row of rows) {
      const step = hysteresisFor(row.from, pick(capacity, dir))

      if (row.to < row.from) {
        lower.push({ change: row, needed: over || row.from - row.to >= step })
      } else if (row.to - row.from >= step && canIncrease(row.name)) {
        increases.push(row)
      }
    }
  }

  return {
    decreases: lower.filter((l) => l.needed || increases.length > 0).map((l) => l.change),
    increases: increases.sort((a, b) => a.to - a.from - (b.to - b.from)),
  }
}

// The changes that take every client to its fixed, safe limits
export const baselineChanges = (
  baseline: DownloaderTarget[],
  current: Map<DownloaderName, DownloaderLimits>,
): ChangePlan => {
  const plan: ChangePlan = { decreases: [], increases: [] }

  for (const target of baseline) {
    for (const dir of DIRECTIONS) {
      const to = dir === "down" ? target.down : target.up
      const from = current.get(target.name)?.[dir] ?? null
      if (to === null || from === null || Math.abs(from - to) < KIB) continue

      const change = { name: target.name, dir, from, to }
      if (to < from) plan.decreases.push(change)
      else plan.increases.push(change)
    }
  }

  return plan
}

// The highest of the last few speed readings, so a momentary stall doesn't make a busy client look idle
export const peakSpeeds = (samples: Pair<number>[]): Pair<number> => ({
  down: Math.max(0, ...samples.map((s) => s.down)),
  up: Math.max(0, ...samples.map((s) => s.up)),
})

// The user's maximum for one client, or Infinity when there isn't one
export const capFor = (config: BalancerConfig, name: DownloaderName): Pair<number> => {
  const cap = config.caps.find((c) => c.name === name)
  return { down: cap?.down || Infinity, up: cap?.up || Infinity }
}
