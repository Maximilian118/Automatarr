import { AuthRequest, requireAuth } from "../../middleware/auth"
import { BalancerConfig, DownloaderName, Pair } from "../../types/networkBalancerTypes"
import {
  BalancerReading,
  balancerBlockers,
  disableNetworkBalancer,
  enableNetworkBalancer,
  getBalancerHistory,
  getBalancerReading,
  updateNetworkBalancerConfig,
} from "../../shared/networkBalancer"
import { BALANCER_DOWNLOADERS } from "../../shared/networkBalancerClients"
import { getUnifiLoginPause } from "../../shared/unifiRequests"

// GraphQL can't send Infinity, so "no limit" is sent as -1
const limitOut = (value: number | null | undefined): number | null => {
  if (value === null || value === undefined) return null
  return Number.isFinite(value) ? value : -1
}

// A capacity or budget of 0 means it isn't known yet
const knownOrNull = (pair: Pair<number | null>): Pair<number | null> => ({
  down: pair.down || null,
  up: pair.up || null,
})

// Share of capacity in use, as a percentage
const saturation = (wan: Pair<number>, capacity: Pair<number>): Pair<number | null> => ({
  down: capacity.down ? (wan.down / capacity.down) * 100 : null,
  up: capacity.up ? (wan.up / capacity.up) * 100 : null,
})

// Turn a balancer reading into what the Network page shows
const buildStatus = (reading: BalancerReading, tokens: string[]) => {
  const { doc, plan, snapshot } = reading
  const { history, events } = getBalancerHistory()

  return {
    enabled: doc.enabled,
    enabled_at: doc.enabled_at,
    disabled_reason: doc.disabled_reason,
    disabled_at: doc.disabled_at,
    takeover_at: doc.takeover_at,
    changes: doc.changes ?? [],
    blockers: doc.enabled ? [] : balancerBlockers(reading),
    ready: plan.ready,
    degraded: plan.degraded,
    capacity: knownOrNull(plan.capacity),
    capacity_source_down: plan.capacity_source.down,
    capacity_source_up: plan.capacity_source.up,
    reserve: plan.reserve,
    hard: plan.hard,
    wan: plan.wan,
    household: plan.household,
    budget: plan.budget,
    saturation: saturation(plan.wan, plan.capacity),
    recommended_capacity: plan.recommended.capacity,
    recommended_reserve: plan.recommended.reserve,
    recommended_overhead_pct: plan.recommended.overhead_pct,
    unifi: {
      connected: !!snapshot,
      error: reading.unifi_error,
      isp_name: snapshot?.isp_name ?? null,
      mode: snapshot?.mode ?? "unknown",
      latency: snapshot?.latency ?? null,
      wans: snapshot?.wans ?? [],
      speedtest_down: snapshot?.speedtest?.down ?? null,
      speedtest_up: snapshot?.speedtest?.up ?? null,
      speedtest_at: snapshot?.speedtest?.at ?? null,
      login_paused_until: getUnifiLoginPause(),
    },
    downloaders: reading.adapters.map((adapter) => {
      const state = reading.states.get(adapter.name)
      const target = plan.targets.find((t) => t.name === adapter.name)
      const baseline = plan.baseline.find((t) => t.name === adapter.name)
      const managed = doc.downloaders.find((d) => d.name === adapter.name)

      return {
        name: adapter.name,
        label: adapter.label,
        reachable: !!state,
        error: reading.errors.get(adapter.name) ?? null,
        active: state?.active ?? false,
        paused: state?.paused ?? false,
        hungry: target?.hungry ?? false,
        supports_upload: adapter.supports_upload,
        speed_down: state?.speed.down ?? 0,
        speed_up: state?.speed.up ?? 0,
        limit_down: limitOut(state?.limits.down),
        limit_up: limitOut(state?.limits.up),
        target_down: target?.down ?? null,
        target_up: target?.up ?? null,
        baseline_down: baseline?.down ?? null,
        baseline_up: baseline?.up ?? null,
        pending_restore: managed?.pending_restore ?? false,
        snapshot: managed?.snapshot ?? [],
      }
    }),
    config: { ...doc.config, caps: doc.config?.caps ?? [] },
    history,
    events,
    tokens,
  }
}

// A blank, zero or missing number means "let Automatarr decide". Anything else must be a positive number
const optionalPositive = (value: number | null | undefined, field: string): number | null => {
  if (value === null || value === undefined || value === 0) return null
  if (!Number.isFinite(value) || value < 0) throw new Error(`${field} must be a positive number.`)
  return value
}

// Check the Network page's settings and turn them into balancer settings
const validateConfig = (input: Partial<BalancerConfig>): BalancerConfig => {
  const config: BalancerConfig = {
    capacity_down: optionalPositive(input.capacity_down, "ISP download speed"),
    capacity_up: optionalPositive(input.capacity_up, "ISP upload speed"),
    reserve_down: optionalPositive(input.reserve_down, "Download reserve"),
    reserve_up: optionalPositive(input.reserve_up, "Upload reserve"),
    overhead_pct: optionalPositive(input.overhead_pct, "Overhead"),
    caps: (input.caps ?? [])
      .filter((cap) => BALANCER_DOWNLOADERS.some((d) => d.name === cap.name))
      .map((cap) => ({
        name: cap.name as DownloaderName,
        down: optionalPositive(cap.down, "Maximum download speed"),
        up: optionalPositive(cap.up, "Maximum upload speed"),
      })),
  }

  if (config.overhead_pct !== null && config.overhead_pct > 50) throw new Error("Overhead can't be more than 50%.")

  if (config.capacity_down && config.reserve_down && config.reserve_down >= config.capacity_down) {
    throw new Error("The download reserve must be less than the ISP download speed.")
  }

  if (config.capacity_up && config.reserve_up && config.reserve_up >= config.capacity_up) {
    throw new Error("The upload reserve must be less than the ISP upload speed.")
  }

  return config
}

const networkResolvers = {
  // Everything the Network page shows: live traffic, the balancer's decisions and its settings
  getNetworkStatus: async (_: unknown, req: AuthRequest) => {
    requireAuth(req)
    return buildStatus(await getBalancerReading(), req.tokens)
  },

  // Save the Network page's settings
  updateNetworkBalancer: async (args: { input: Partial<BalancerConfig> }, req: AuthRequest) => {
    requireAuth(req)
    await updateNetworkBalancerConfig(validateConfig(args.input))
    return buildStatus(await getBalancerReading(), req.tokens)
  },

  // Turn the balancer on or off. Turning it on throws with every reason it can't be turned on
  setNetworkBalancer: async (args: { enabled: boolean }, req: AuthRequest) => {
    requireAuth(req)

    if (args.enabled) await enableNetworkBalancer()
    else await disableNetworkBalancer()

    return buildStatus(await getBalancerReading(), req.tokens)
  },
}

export default networkResolvers
