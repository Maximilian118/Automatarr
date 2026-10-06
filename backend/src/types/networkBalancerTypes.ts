import { UnifiSnapshot } from "./unifiTypes"

// Every download client the network balancer can control
export type DownloaderName = "sabnzbd" | "qbittorrent"

// Traffic direction. "down" = download, "up" = upload
export type Direction = "down" | "up"

// A value for each direction
export type Pair<T> = { down: T; up: T }

// Speed limits in bytes per second. Infinity = no limit. up is null when the client can't limit upload
export type DownloaderLimits = { down: number; up: number | null }

// What a download client is doing right now. Speeds are bytes per second
export type DownloaderState = {
  speed: Pair<number>
  limits: DownloaderLimits // The limits in force right now
  active: boolean // Has something it's downloading right now
  paused: boolean
  alt_mode: boolean // qBittorrent's alternative speed limits are in force
}

// Reads and sets the speed limits of one download client. Every method throws if the client can't be reached
export interface DownloaderAdapter {
  name: DownloaderName
  label: string
  supports_upload: boolean
  ack_ratio: number // Upload the client uses to acknowledge its downloads, as a share of its download speed
  url: string // Where the client is, so a changed connection can be noticed
  readState(): Promise<DownloaderState>
  readLimits(): Promise<DownloaderLimits>
  applyLimits(limits: Partial<Pair<number>>): Promise<void>
  snapshot(): Promise<string[]> // The client's own speed settings, described for the page
  enforceOwnership(floor: Pair<number>): Promise<string[]> // Turns off anything else that changes its limits. Returns what changed
}

// A user's maximum speed for one download client, bytes per second. Null = no maximum
export type DownloaderCap = {
  name: DownloaderName
  down: number | null
  up: number | null
}

// The balancer settings from the Network page. Null = Automatarr decides
export type BalancerConfig = {
  capacity_down: number | null // ISP download speed, bytes per second
  capacity_up: number | null // ISP upload speed, bytes per second
  reserve_down: number | null // Download bandwidth always kept free for everything else, bytes per second
  reserve_up: number | null // Upload bandwidth always kept free for everything else, bytes per second
  overhead_pct: number | null // Protocol overhead on top of what the download clients report, percent
  caps: DownloaderCap[]
}

// Where a capacity figure came from
export type CapacitySource = "manual" | "plan" | "speedtest" | "last" | "none"

// One download client as the balancer math sees it
export type DownloaderInput = {
  name: DownloaderName
  supports_upload: boolean
  ack_ratio: number
  active: boolean
  speed: Pair<number> // The latest reading, matched against the WAN's latest reading
  peak: Pair<number> // The highest of the last few readings, so one dip doesn't make a busy client look idle
  limits: DownloaderLimits
  cap: Pair<number> // Infinity = no maximum
}

// What the last decision worked out, carried into the next one
export type BalancerHistory = {
  household: Pair<number | null> // Smoothed household traffic
  household_raw: Pair<number | null> // Household traffic as last measured, before smoothing
  budget: Pair<number | null>
}

// Everything the balancer math needs for one decision
export type PlanInputs = {
  config: BalancerConfig
  snapshot: UnifiSnapshot | null // Null when UniFi can't be reached
  last_capacity: Pair<number | null>
  previous: BalancerHistory
  downloaders: DownloaderInput[]
}

// The limits the balancer wants for one download client
export type DownloaderTarget = {
  name: DownloaderName
  down: number
  up: number | null
  hungry: boolean // Using nearly all of its limit, so it could go faster
}

// What the balancer would recommend if every field on the Network page were blank
export type BalancerRecommendation = {
  capacity: Pair<number | null>
  reserve: Pair<number | null>
  overhead_pct: number
}

// One balancing decision. Speeds are bytes per second
export type BalancerPlan = {
  ready: boolean // ISP speed is known, so limits can be worked out
  degraded: boolean // UniFi couldn't be reached, so household traffic is unknown
  capacity: Pair<number>
  capacity_source: Pair<CapacitySource>
  reserve: Pair<number>
  hard: Pair<number> // Capacity minus reserve. The download clients' limits never add up to more than this
  wan: Pair<number> // Live WAN traffic
  household: Pair<number> // WAN traffic that isn't the download clients, smoothed
  household_raw: Pair<number> // WAN traffic that isn't the download clients, as measured this time
  budget: Pair<number> // What the download clients can share right now
  floors: Pair<number> // The least any download client is given
  targets: DownloaderTarget[]
  baseline: DownloaderTarget[] // The fixed, safe split used whenever the balancer isn't running
  base_hard: Pair<number> // What the fixed split shares: the slowest WAN's capacity minus reserve
  recommended: BalancerRecommendation
}

// One limit to change
export type LimitChange = {
  name: DownloaderName
  dir: Direction
  from: number
  to: number
}

// The limit changes for one decision. Decreases always happen before increases
export type ChangePlan = {
  decreases: LimitChange[]
  increases: LimitChange[]
}

// One point on the Network page's live chart. Speeds are bytes per second
export type NetworkSample = {
  at: string
  wan_down: number
  wan_up: number
  household_down: number
  budget_down: number
  downloaders: { name: DownloaderName; down: number; up: number }[]
}

// Something the balancer did or noticed, for the Network page
export type NetworkEvent = {
  at: string
  level: "info" | "warn" | "error"
  message: string
}
