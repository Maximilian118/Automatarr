import { NetworkConfig, NetworkStatus } from "../../types/networkType"
import { AuthHandlers, graphqlRequest } from "./graphqlRequest"

// Every field the Network page reads
const networkStatusFields = `
  enabled enabled_at disabled_reason disabled_at takeover_at changes blockers ready degraded
  capacity { down up } capacity_source_down capacity_source_up
  reserve { down up } hard { down up } wan { down up } household { down up } budget { down up }
  saturation { down up } recommended_capacity { down up } recommended_reserve { down up } recommended_overhead_pct
  unifi {
    connected error isp_name mode latency speedtest_down speedtest_up speedtest_at login_paused_until
    wans { group name up active down upload plan_down plan_up }
  }
  downloaders {
    name label reachable error active paused hungry supports_upload speed_down speed_up
    limit_down limit_up target_down target_up baseline_down baseline_up pending_restore snapshot
  }
  config { capacity_down capacity_up reserve_down reserve_up overhead_pct caps { name down up } }
  history { at wan_down wan_up household_down budget_down downloaders { name down up } }
  events { at level message }
  tokens
`

// Get the network's live traffic and what the balancer is doing
export const getNetworkStatus = (auth: AuthHandlers): Promise<NetworkStatus> =>
  graphqlRequest<NetworkStatus>("getNetworkStatus", `query { getNetworkStatus { ${networkStatusFields} } }`, undefined, auth)

// Save the balancer's settings
export const updateNetworkBalancer = (config: NetworkConfig, auth: AuthHandlers): Promise<NetworkStatus> =>
  graphqlRequest<NetworkStatus>(
    "updateNetworkBalancer",
    `mutation UpdateNetworkBalancer($input: NetworkBalancerInput!) {
      updateNetworkBalancer(input: $input) { ${networkStatusFields} }
    }`,
    { input: config },
    auth,
  )

// Turn the balancer on or off. Turning it on fails with every reason it can't be turned on
export const setNetworkBalancer = (enabled: boolean, auth: AuthHandlers): Promise<NetworkStatus> =>
  graphqlRequest<NetworkStatus>(
    "setNetworkBalancer",
    `mutation SetNetworkBalancer($enabled: Boolean!) {
      setNetworkBalancer(enabled: $enabled) { ${networkStatusFields} }
    }`,
    { enabled },
    auth,
  )
