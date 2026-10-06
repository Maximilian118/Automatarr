// Every speed is bytes per second. A limit of -1 means "no limit". Null means unknown or not applicable.

export type NetworkPair = { down: number | null; up: number | null }

export type DownloaderName = "sabnzbd" | "qbittorrent"

// A WAN port on the gateway with its live traffic and ISP plan
export type NetworkWan = {
  group: string
  name: string
  up: boolean
  active: boolean
  down: number
  upload: number
  plan_down: number | null
  plan_up: number | null
}

// What Automatarr can see of the UniFi gateway
export type NetworkUnifi = {
  connected: boolean
  error: string | null
  isp_name: string | null
  mode: "failover" | "distributed" | "unknown"
  latency: number | null
  wans: NetworkWan[]
  speedtest_down: number | null
  speedtest_up: number | null
  speedtest_at: string | null
  login_paused_until: string | null
}

// One download client: what it's doing and what the balancer wants for it
export type NetworkDownloader = {
  name: DownloaderName
  label: string
  reachable: boolean
  error: string | null
  active: boolean
  paused: boolean
  hungry: boolean
  supports_upload: boolean
  speed_down: number
  speed_up: number
  limit_down: number | null
  limit_up: number | null
  target_down: number | null
  target_up: number | null
  baseline_down: number | null
  baseline_up: number | null
  pending_restore: boolean
  snapshot: string[]
}

// A user's maximum speeds for one download client. Null = no maximum
export type NetworkCap = { name: DownloaderName; down: number | null; up: number | null }

// The Network page's settings. Null = Automatarr decides
export type NetworkConfig = {
  capacity_down: number | null
  capacity_up: number | null
  reserve_down: number | null
  reserve_up: number | null
  overhead_pct: number | null
  caps: NetworkCap[]
}

// One point on the live chart
export type NetworkSample = {
  at: string
  wan_down: number
  wan_up: number
  household_down: number
  budget_down: number
  downloaders: { name: DownloaderName; down: number; up: number }[]
}

// Something the balancer did or noticed
export type NetworkEvent = {
  at: string
  level: "info" | "warn" | "error"
  message: string
}

// Where an ISP speed figure came from
export type CapacitySource = "manual" | "plan" | "speedtest" | "last" | "none"

// Everything the Network page shows
export type NetworkStatus = {
  enabled: boolean
  enabled_at: string | null
  disabled_reason: string | null
  disabled_at: string | null
  takeover_at: string | null
  changes: string[]
  blockers: string[]
  ready: boolean
  degraded: boolean
  capacity: NetworkPair
  capacity_source_down: CapacitySource
  capacity_source_up: CapacitySource
  reserve: NetworkPair
  hard: NetworkPair
  wan: NetworkPair
  household: NetworkPair
  budget: NetworkPair
  saturation: NetworkPair
  recommended_capacity: NetworkPair
  recommended_reserve: NetworkPair
  recommended_overhead_pct: number
  unifi: NetworkUnifi
  downloaders: NetworkDownloader[]
  config: NetworkConfig
  history: NetworkSample[]
  events: NetworkEvent[]
  tokens?: string[] | null
}
