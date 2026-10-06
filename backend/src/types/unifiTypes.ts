// Every UniFi Network legacy API response is wrapped in this envelope
export type UnifiEnvelope<T> = {
  meta: { rc: string; msg?: string }
  data: T[]
}

// One physical WAN port as the gateway reports it in stat/device (wan1, wan2, ...)
export type UnifiRawWan = {
  name?: string
  ifname?: string
  up?: boolean
  enable?: boolean
  is_uplink?: boolean
  "rx_bytes-r"?: number // Download rate, bytes per second
  "tx_bytes-r"?: number // Upload rate, bytes per second
  max_speed?: number // Link speed in Mbps
}

// The gateway's last speedtest as stat/device reports it
export type UnifiRawSpeedtest = {
  rundate?: number // Epoch seconds
  xput_download?: number // Mbps
  xput_upload?: number // Mbps
  latency?: number // ms
}

// The fields Automatarr reads from the gateway in stat/device
export type UnifiRawDevice = {
  mac: string
  type?: string // "udm", "uxg", "ugw" etc for gateways
  model?: string
  name?: string
  uplink?: UnifiRawWan & { latency?: number; xput_down?: number; xput_up?: number }
  "speedtest-status"?: UnifiRawSpeedtest
  [key: string]: unknown // wan1, wan2 etc
}

// One subsystem in stat/health. "wan" and "www" are the ones Automatarr reads
export type UnifiRawHealth = {
  subsystem: string
  status?: string
  "rx_bytes-r"?: number
  "tx_bytes-r"?: number
  isp_name?: string
  latency?: number
  xput_down?: number // Last speedtest, Mbps
  xput_up?: number // Last speedtest, Mbps
  speedtest_lastrun?: number // Epoch seconds
}

// A WAN's configuration. Found in v2 wan/enriched-configuration and legacy rest/networkconf
export type UnifiRawWanConfig = {
  name?: string
  purpose?: string
  wan_networkgroup?: string // "WAN", "WAN2" etc
  wan_load_balance_type?: string // "failover-only" or "weighted"
  wan_provider_capabilities?: {
    download_kilobits_per_second?: number // The ISP plan's download speed. 0 or missing = not set
    upload_kilobits_per_second?: number // The ISP plan's upload speed. 0 or missing = not set
  }
}

// How the gateway uses more than one WAN
export type UnifiWanMode = "failover" | "distributed" | "unknown"

// A WAN port with its live traffic and its ISP plan. Speeds are bytes per second
export type UnifiWan = {
  group: string // "WAN", "WAN2" etc
  name: string
  up: boolean
  active: boolean // Carrying internet traffic now
  down: number // Live download rate
  upload: number // Live upload rate
  plan_down: number | null // ISP plan download speed set in UniFi. Null = not set
  plan_up: number | null // ISP plan upload speed set in UniFi. Null = not set
}

// The gateway's last speedtest. Speeds are bytes per second
export type UnifiSpeedtest = {
  down: number
  up: number
  at: string | null // When it ran
}

// Everything Automatarr knows about the network at one moment
export type UnifiSnapshot = {
  wans: UnifiWan[]
  mode: UnifiWanMode
  isp_name: string | null
  latency: number | null // ms
  speedtest: UnifiSpeedtest | null
}
