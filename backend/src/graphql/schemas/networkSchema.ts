// Every speed is bytes per second. A limit of -1 means "no limit". Null means unknown or not applicable.
const networkSchema = `
  type NetworkPair {
    down: Float
    up: Float
  }

  type NetworkWan {
    group: String!
    name: String!
    up: Boolean!
    active: Boolean!
    down: Float!
    upload: Float!
    plan_down: Float
    plan_up: Float
  }

  type NetworkUnifi {
    connected: Boolean!
    error: String
    isp_name: String
    mode: String!
    latency: Float
    wans: [NetworkWan!]!
    speedtest_down: Float
    speedtest_up: Float
    speedtest_at: String
    login_paused_until: String
  }

  type NetworkDownloader {
    name: String!
    label: String!
    reachable: Boolean!
    error: String
    active: Boolean!
    paused: Boolean!
    hungry: Boolean!
    supports_upload: Boolean!
    speed_down: Float!
    speed_up: Float!
    limit_down: Float
    limit_up: Float
    target_down: Float
    target_up: Float
    baseline_down: Float
    baseline_up: Float
    pending_restore: Boolean!
    snapshot: [String!]!
  }

  type NetworkCap {
    name: String!
    down: Float
    up: Float
  }

  type NetworkConfig {
    capacity_down: Float
    capacity_up: Float
    reserve_down: Float
    reserve_up: Float
    overhead_pct: Float
    caps: [NetworkCap!]!
  }

  type NetworkSampleDownloader {
    name: String!
    down: Float!
    up: Float!
  }

  type NetworkSample {
    at: String!
    wan_down: Float!
    wan_up: Float!
    household_down: Float!
    budget_down: Float!
    downloaders: [NetworkSampleDownloader!]!
  }

  type NetworkEvent {
    at: String!
    level: String!
    message: String!
  }

  type NetworkStatus {
    enabled: Boolean!
    enabled_at: String
    disabled_reason: String
    disabled_at: String
    takeover_at: String
    changes: [String!]!
    blockers: [String!]!
    ready: Boolean!
    degraded: Boolean!
    capacity: NetworkPair!
    capacity_source_down: String!
    capacity_source_up: String!
    reserve: NetworkPair!
    hard: NetworkPair!
    wan: NetworkPair!
    household: NetworkPair!
    budget: NetworkPair!
    saturation: NetworkPair!
    recommended_capacity: NetworkPair!
    recommended_reserve: NetworkPair!
    recommended_overhead_pct: Float!
    unifi: NetworkUnifi!
    downloaders: [NetworkDownloader!]!
    config: NetworkConfig!
    history: [NetworkSample!]!
    events: [NetworkEvent!]!
    tokens: [String!]
  }

  input NetworkCapInput {
    name: String!
    down: Float
    up: Float
  }

  input NetworkBalancerInput {
    capacity_down: Float
    capacity_up: Float
    reserve_down: Float
    reserve_up: Float
    overhead_pct: Float
    caps: [NetworkCapInput!]
  }
`

export default networkSchema
