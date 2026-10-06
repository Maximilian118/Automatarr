import {
  ChangePlan,
  Direction,
  DownloaderAdapter,
  DownloaderLimits,
  DownloaderName,
  LimitChange,
  Pair,
} from "../types/networkBalancerTypes"
import { floorToKiB, KIB, sum } from "./networkBalancerMath"

// Applies limit changes to the download clients without ever letting their limits add up to more than the budget.
// Kept free of database and request code so the simulator can run it against fake clients.
//
// "upper" holds a bound for every client's limit that is always at least the real limit:
// - A confirmed read sets it to the real value.
// - Before a limit is raised, the new value is saved as the bound first (write-ahead). If Automatarr dies between
//   saving and raising, the saved bound still covers the real limit.
// - A client that has never been read, or has no limit, has a bound of Infinity, so nothing else can be raised.

export type UpperBounds = Map<DownloaderName, Pair<number>>

export type ApplyDeps = {
  adapters: DownloaderAdapter[]
  upper: UpperBounds
  confirmed: Map<DownloaderName, DownloaderLimits> // The latest limits read back from each client
  persistUpper: (name: DownloaderName, bounds: Pair<number>) => Promise<boolean> // Saves a bound. False = not saved
}

export type ApplyResult = {
  changed: LimitChange[] // Changes sent to a client
  held: LimitChange[] // Increases skipped or shrunk to stay inside the budget
  errors: string[]
}

// Read a client's limits and record them as both confirmed and its new bound
const confirmLimits = async (deps: ApplyDeps, adapter: DownloaderAdapter): Promise<boolean> => {
  try {
    const limits = await adapter.readLimits()
    deps.confirmed.set(adapter.name, limits)

    const bounds = { down: limits.down, up: limits.up ?? 0 }
    const previous = deps.upper.get(adapter.name)
    deps.upper.set(adapter.name, bounds)

    if (!previous || previous.down !== bounds.down || previous.up !== bounds.up) {
      await deps.persistUpper(adapter.name, bounds)
    }

    return true
  } catch {
    return false
  }
}

// The bound for one client and direction. Unknown clients count as unlimited. Clients that can't upload use none
const boundOf = (deps: ApplyDeps, adapter: DownloaderAdapter, dir: Direction): number => {
  if (dir === "up" && !adapter.supports_upload) return 0
  return deps.upper.get(adapter.name)?.[dir] ?? Infinity
}

// Download acknowledgements every client except one sends, worked out from their download bounds
const ackOfOthers = (deps: ApplyDeps, name: DownloaderName): number =>
  sum(deps.adapters.filter((a) => a.name !== name).map((a) => a.ack_ratio * boundOf(deps, a, "down")))

// The most one client can be raised to without the clients' bounds adding up to more than the budget.
// Upload includes every client's download acknowledgements, and a download raise is also limited by the upload
// its extra acknowledgements would use.
export const headroomFor = (deps: ApplyDeps, adapter: DownloaderAdapter, dir: Direction, budget: Pair<number>): number => {
  const others = sum(deps.adapters.filter((a) => a.name !== adapter.name).map((a) => boundOf(deps, a, dir)))

  if (dir === "up") {
    const ownAck = adapter.ack_ratio * boundOf(deps, adapter, "down")
    return budget.up - others - ackOfOthers(deps, adapter.name) - ownAck
  }

  const room = budget.down - others
  if (adapter.ack_ratio <= 0) return room

  const uploads = sum(deps.adapters.map((a) => boundOf(deps, a, "up")))
  const uploadRoom = (budget.up - uploads - ackOfOthers(deps, adapter.name)) / adapter.ack_ratio
  return Math.min(room, uploadRoom)
}

// Group changes by client so each client gets one request
const byAdapter = (deps: ApplyDeps, changes: LimitChange[]) =>
  deps.adapters
    .map((adapter) => ({ adapter, changes: changes.filter((c) => c.name === adapter.name) }))
    .filter((group) => group.changes.length > 0)

// Turn a list of changes for one client into the limits to send
const limitsOf = (changes: LimitChange[]): Partial<Pair<number>> =>
  Object.fromEntries(changes.map((c) => [c.dir, floorToKiB(c.to)]))

// Lower limits first and confirm them, then raise limits only as far as the confirmed bounds of the other
// clients allow. A failed decrease leaves the old bound in place, which is still above the real limit.
export const applyChanges = async (
  deps: ApplyDeps,
  plan: ChangePlan,
  budget: Pair<number>,
): Promise<ApplyResult> => {
  const result: ApplyResult = { changed: [], held: [], errors: [] }

  // Decreases are always safe to send, so they go first and in parallel
  await Promise.all(
    byAdapter(deps, plan.decreases).map(async ({ adapter, changes }) => {
      try {
        await adapter.applyLimits(limitsOf(changes))
        result.changed.push(...changes)
      } catch (err) {
        result.errors.push(`${adapter.label}: couldn't lower its limit. ${err}`)
      }

      await confirmLimits(deps, adapter)
    }),
  )

  // Increases go one at a time, each checked against the latest bounds of every other client
  for (const change of plan.increases) {
    const adapter = deps.adapters.find((a) => a.name === change.name)
    if (!adapter) continue

    const allowed = headroomFor(deps, adapter, change.dir, budget)
    const to = Math.floor(Math.min(change.to, allowed) / KIB) * KIB

    if (to < change.to) result.held.push(change)
    if (to <= change.from + KIB) continue

    // Save the new bound before raising, so a crash mid-raise can't leave an unknown higher limit
    const current = deps.upper.get(change.name) ?? { down: Infinity, up: Infinity }
    const raised = { ...current, [change.dir]: Math.max(to, current[change.dir]) }

    if (!(await deps.persistUpper(change.name, raised))) {
      result.errors.push(`${adapter.label}: couldn't save its new limit, so it wasn't raised.`)
      continue
    }

    deps.upper.set(change.name, raised)

    try {
      await adapter.applyLimits({ [change.dir]: to })
      result.changed.push({ ...change, to })
    } catch (err) {
      result.errors.push(`${adapter.label}: couldn't raise its limit. ${err}`)
    }

    await confirmLimits(deps, adapter)
  }

  return result
}
