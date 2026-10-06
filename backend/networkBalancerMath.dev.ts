// Checks for the network balancer's pure maths. Not compiled into the app (*.dev.ts).
//
// Usage: npx ts-node -T networkBalancerMath.dev.ts

import assert from "node:assert/strict"
import {
  baselineChanges,
  computePlan,
  floorToKiB,
  KIB,
  mbpsToBps,
  nextBudget,
  planChanges,
  recommendReserve,
  selectCapacity,
  smallestPlan,
  smoothHousehold,
  sum,
  waterFill,
} from "./src/shared/networkBalancerMath"
import { BalancerConfig, DownloaderInput, PlanInputs } from "./src/types/networkBalancerTypes"
import { UnifiSnapshot, UnifiWan } from "./src/types/unifiTypes"

let passed = 0

// Run one named check and report it
const check = (name: string, fn: () => void): void => {
  fn()
  passed++
  console.log(`  ✓ ${name}`)
}

// Two numbers are equal to within a byte per second
const near = (actual: number, expected: number, slack = 1): void =>
  assert.ok(Math.abs(actual - expected) <= slack, `expected ${expected}, got ${actual}`)

const M = mbpsToBps

// A WAN with sensible defaults
const wan = (overrides: Partial<UnifiWan>): UnifiWan => ({
  group: "WAN",
  name: "WAN",
  up: true,
  active: true,
  down: 0,
  upload: 0,
  plan_down: M(100),
  plan_up: M(20),
  ...overrides,
})

// A snapshot with the given WANs
const snap = (wans: UnifiWan[], mode: UnifiSnapshot["mode"] = "failover"): UnifiSnapshot => ({
  wans,
  mode,
  isp_name: "Test ISP",
  latency: 10,
  speedtest: { down: M(80), up: M(15), at: null },
})

const blankConfig: BalancerConfig = {
  capacity_down: null,
  capacity_up: null,
  reserve_down: null,
  reserve_up: null,
  overhead_pct: null,
  caps: [],
}

// A download client with sensible defaults
const client = (overrides: Partial<DownloaderInput>): DownloaderInput => ({
  name: "sabnzbd",
  supports_upload: false,
  ack_ratio: 0.03,
  active: false,
  speed: { down: 0, up: 0 },
  peak: { down: 0, up: 0 },
  limits: { down: M(45), up: null },
  cap: { down: Infinity, up: Infinity },
  ...overrides,
})

// Inputs for one plan with no history
const inputs = (overrides: Partial<PlanInputs>): PlanInputs => ({
  config: blankConfig,
  snapshot: snap([wan({})]),
  last_capacity: { down: null, up: null },
  previous: {
    household: { down: null, up: null },
    household_raw: { down: null, up: null },
    budget: { down: null, up: null },
  },
  downloaders: [
    client({ name: "sabnzbd" }),
    client({ name: "qbittorrent", supports_upload: true, ack_ratio: 0.02, limits: { down: M(45), up: M(10) } }),
  ],
  ...overrides,
})

console.log("Capacity")

check("the user's figure beats the UniFi plan, which beats the speedtest, which beats the last known value", () => {
  assert.deepEqual(selectCapacity(M(50), snap([wan({})]), M(10), "down"), { value: M(50), source: "manual" })
  assert.deepEqual(selectCapacity(null, snap([wan({})]), M(10), "down"), { value: M(100), source: "plan" })
  assert.deepEqual(selectCapacity(null, snap([wan({ plan_down: null })]), M(10), "down"), {
    value: M(80),
    source: "speedtest",
  })
  assert.deepEqual(selectCapacity(null, null, M(10), "down"), { value: M(10), source: "last" })
  assert.deepEqual(selectCapacity(null, null, null, "down"), { value: null, source: "none" })
})

check("failover counts only the active WAN, load balancing adds up every WAN that's up", () => {
  const wans = [wan({}), wan({ group: "WAN2", active: false, plan_down: M(30) })]
  near(selectCapacity(null, snap(wans, "failover"), null, "down").value ?? 0, M(100))
  near(selectCapacity(null, snap(wans, "distributed"), null, "down").value ?? 0, M(130))

  const failedOver = [wan({ up: false, active: false }), wan({ group: "WAN2", active: true, plan_down: M(30) })]
  near(selectCapacity(null, snap(failedOver, "failover"), null, "down").value ?? 0, M(30))
})

check("the fixed split is sized for the slowest WAN", () => {
  const wans = [wan({}), wan({ group: "WAN2", active: false, plan_down: M(30) })]
  near(smallestPlan(snap(wans), "down") ?? 0, M(30))
})

console.log("Reserve, floors and units")

check("recommended reserve is 10% down (5-50 Mbps) and 15% up (2-20 Mbps)", () => {
  near(recommendReserve(M(100), "down"), M(10))
  near(recommendReserve(M(20), "down"), M(5))
  near(recommendReserve(M(1000), "down"), M(50))
  near(recommendReserve(M(20), "up"), M(3))
  near(recommendReserve(M(500), "up"), M(20))
})

check("limits round down to whole KiB and are never 0, which would mean no limit", () => {
  assert.equal(floorToKiB(0), KIB)
  assert.equal(floorToKiB(500), KIB)
  assert.equal(floorToKiB(3 * KIB + 900), 3 * KIB)
})

console.log("Household and budget")

check("household traffic rises once two readings agree, at once, and falls slowly", () => {
  assert.equal(smoothHousehold(M(10), M(10), M(50)), M(10), "one high reading alone is ignored")
  assert.equal(smoothHousehold(M(10), M(50), M(50)), M(50), "two high readings in a row are followed at once")
  assert.equal(smoothHousehold(M(10), M(30), M(50)), M(30), "rises only to the smaller of the two")
  const down = smoothHousehold(M(50), M(10), M(10))
  assert.ok(down > M(40) && down < M(50), "falls only a little in one tick")
  assert.equal(smoothHousehold(null, null, M(20)), M(20))
})

check("the budget shrinks at once, grows by at most 5% of capacity a tick and holds without UniFi", () => {
  near(nextBudget(M(90), M(90), M(40), M(100), 0, false), M(50))
  near(nextBudget(M(50), M(90), 0, M(100), 0, false), M(55))
  near(nextBudget(M(50), M(90), 0, M(100), 0, true), M(50))
  near(nextBudget(null, M(90), M(200), M(100), M(2), false), M(2))
})

console.log("Splitting the budget")

check("an idle client drops to its floor and the busy one gets the rest", () => {
  const [idle, busy] = waterFill(M(90), [
    { floor: M(1), want: M(1), cap: Infinity, weight: 1 },
    { floor: M(1), want: Infinity, cap: Infinity, weight: 1 },
  ])
  near(idle, M(1))
  near(busy, M(89))
})

check("two hungry clients share equally", () => {
  const [a, b] = waterFill(M(90), [
    { floor: M(1), want: Infinity, cap: Infinity, weight: 1 },
    { floor: M(1), want: Infinity, cap: Infinity, weight: 1 },
  ])
  near(a, M(45))
  near(b, M(45))
})

check("a client that can't use its share keeps what it needs and the other gets the rest", () => {
  const [slow, fast] = waterFill(M(90), [
    { floor: M(1), want: M(20), cap: Infinity, weight: 1 },
    { floor: M(1), want: Infinity, cap: Infinity, weight: 1 },
  ])
  near(slow, M(20))
  near(fast, M(70))
})

check("a user's maximum is respected and the spare goes to the other client", () => {
  const [capped, other] = waterFill(M(90), [
    { floor: M(1), want: Infinity, cap: M(30), weight: 1 },
    { floor: M(1), want: Infinity, cap: Infinity, weight: 1 },
  ])
  near(capped, M(30))
  near(other, M(60))
})

check("slack is shared when nobody wants it, so both start fast", () => {
  const [a, b] = waterFill(M(90), [
    { floor: M(1), want: M(1), cap: Infinity, weight: 1 },
    { floor: M(1), want: M(1), cap: Infinity, weight: 1 },
  ])
  near(a, M(45))
  near(b, M(45))
})

check("floors bigger than the budget are scaled down to fit", () => {
  const split = waterFill(M(1), [
    { floor: M(1), want: Infinity, cap: Infinity, weight: 1 },
    { floor: M(1), want: Infinity, cap: Infinity, weight: 1 },
  ])
  near(sum(split), M(1))
})

console.log("Whole plans")

check("only qBittorrent busy: it gets nearly the whole budget, SABnzbd its floor", () => {
  const plan = computePlan(
    inputs({
      downloaders: [
        client({ name: "sabnzbd" }),
        client({
          name: "qbittorrent",
          supports_upload: true,
          ack_ratio: 0.02,
          active: true,
          speed: { down: M(44), up: M(2) },
          peak: { down: M(44), up: M(2) },
          limits: { down: M(45), up: M(10) },
        }),
      ],
    }),
  )

  const sab = plan.targets.find((t) => t.name === "sabnzbd")
  const qbit = plan.targets.find((t) => t.name === "qbittorrent")
  assert.ok(plan.ready)
  assert.ok(qbit?.hungry)
  near(sab?.down ?? 0, plan.floors.down, KIB)
  assert.ok((qbit?.down ?? 0) > M(85), `qBittorrent got ${qbit?.down}`)
  assert.ok(sum(plan.targets.map((t) => t.down)) <= plan.budget.down + KIB)
})

check("targets never add up to more than the hard ceiling, upload included", () => {
  const plan = computePlan(inputs({}))
  assert.ok(sum(plan.targets.map((t) => t.down)) <= plan.hard.down)
  const ack = sum(plan.targets.map((t) => (t.name === "sabnzbd" ? 0.03 : 0.02) * t.down))
  assert.ok(sum(plan.targets.map((t) => t.up ?? 0)) + ack <= plan.hard.up + KIB)
})

check("household traffic shrinks the budget", () => {
  const busyHouse = snap([wan({ down: M(40) })])
  const plan = computePlan(inputs({ snapshot: busyHouse }))
  near(plan.household.down, M(40))
  near(plan.budget.down, M(100) - M(10) - M(40))
})

check("the downloaders' own traffic isn't counted as household traffic", () => {
  const plan = computePlan(
    inputs({
      snapshot: snap([wan({ down: M(42) })]),
      downloaders: [
        client({ name: "sabnzbd", active: true, speed: { down: M(40), up: 0 }, peak: { down: M(40), up: 0 } }),
        client({ name: "qbittorrent", supports_upload: true, ack_ratio: 0.02, limits: { down: M(45), up: M(10) } }),
      ],
    }),
  )
  near(plan.household.down, 0)
})

check("without UniFi the plan is degraded and uses the last known capacity", () => {
  const plan = computePlan(inputs({ snapshot: null, last_capacity: { down: M(100), up: M(20) } }))
  assert.ok(plan.degraded)
  assert.ok(plan.ready)
  assert.equal(plan.capacity_source.down, "last")
})

check("no ISP speed at all means the plan isn't ready and makes no targets", () => {
  const plan = computePlan(inputs({ snapshot: snap([wan({ plan_down: null, plan_up: null })]) }))
  const noTest = computePlan(inputs({ snapshot: { ...snap([wan({ plan_down: null, plan_up: null })]), speedtest: null } }))
  assert.ok(plan.ready, "the speedtest fills in")
  assert.ok(!noTest.ready)
  assert.deepEqual(noTest.targets, [])
})

check("the fixed split is even and fits under the slowest WAN", () => {
  const plan = computePlan(
    inputs({ snapshot: snap([wan({}), wan({ group: "WAN2", active: false, plan_down: M(30), plan_up: M(10) })]) }),
  )
  const [sab, qbit] = plan.baseline
  near(sab.down, qbit.down, KIB)
  assert.ok(sab.down + qbit.down <= plan.base_hard.down)
  assert.ok(plan.base_hard.down < M(30))
})

console.log("Limit changes")

check("small changes are skipped, big ones made", () => {
  const current = new Map([
    ["sabnzbd" as const, { down: M(45), up: null }],
    ["qbittorrent" as const, { down: M(45), up: M(10) }],
  ])
  const quiet = planChanges(
    [
      { name: "sabnzbd", down: M(45.5), up: null, hungry: false },
      { name: "qbittorrent", down: M(44.5), up: M(10), hungry: false },
    ],
    current,
    { down: M(90), up: M(17) },
    { down: M(100), up: M(20) },
    () => true,
  )
  assert.equal(quiet.decreases.length + quiet.increases.length, 0)

  const shift = planChanges(
    [
      { name: "sabnzbd", down: M(1), up: null, hungry: false },
      { name: "qbittorrent", down: M(89), up: M(10), hungry: true },
    ],
    current,
    { down: M(90), up: M(17) },
    { down: M(100), up: M(20) },
    () => true,
  )
  assert.equal(shift.decreases.length, 1)
  assert.equal(shift.increases.length, 1)
})

check("being over budget forces every decrease, however small", () => {
  const current = new Map([
    ["sabnzbd" as const, { down: M(50), up: null }],
    ["qbittorrent" as const, { down: M(50), up: M(10) }],
  ])
  const plan = planChanges(
    [
      { name: "sabnzbd", down: M(49.5), up: null, hungry: false },
      { name: "qbittorrent", down: M(40), up: M(10), hungry: false },
    ],
    current,
    { down: M(90), up: M(17) },
    { down: M(100), up: M(20) },
    () => true,
  )
  assert.equal(plan.decreases.length, 2)
})

check("no limit at all is always lowered", () => {
  const plan = baselineChanges(
    [{ name: "sabnzbd", down: M(40), up: null, hungry: false }],
    new Map([["sabnzbd", { down: Infinity, up: null }]]),
  )
  assert.equal(plan.decreases.length, 1)
})

console.log(`\n${passed} checks passed.`)
