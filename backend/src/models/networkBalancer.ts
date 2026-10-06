import mongoose from "mongoose"
import moment from "moment"
import { ObjectId } from "mongodb"
import { BalancerConfig, DownloaderName } from "../types/networkBalancerTypes"

// A download client the network balancer has taken over
export type BalancerDownloaderType = {
  name: DownloaderName
  url: string // The client's URL at takeover. A different URL means a different client
  upper_down: number | null // Bytes per second the client's download limit can't be above. Null = unknown or no limit
  upper_up: number | null // Bytes per second the client's upload limit can't be above. Null = unknown or no limit
  pending_restore: boolean // The balancer turned off while this client couldn't be reached, so it still needs its fixed limits
  snapshot: string[] // The client's own speed settings before takeover, described for the Network page
}

// The network balancer's settings and the state that must survive a restart. There is only ever one document.
// It's kept out of Settings so saving any other page can't switch the balancer back on after it turned itself off.
export type NetworkBalancerType = {
  _id: ObjectId
  enabled: boolean
  enabled_at: string | null
  disabled_reason: string | null // Why the balancer turned itself off. Null when the user turned it off
  disabled_at: string | null
  takeover_in_progress: boolean // Taking over the clients was interrupted. It's finished at the next boot
  takeover_at: string | null
  changes: string[] // What taking over changed in the clients, described for the Network page
  config: BalancerConfig
  downloaders: BalancerDownloaderType[]
  last_capacity_down: number | null // The last known ISP speeds, used when UniFi can't be reached
  last_capacity_up: number | null
  updated_at: string
}

const capSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    down: { type: Number, default: null },
    up: { type: Number, default: null },
  },
  { _id: false },
)

const configSchema = new mongoose.Schema(
  {
    capacity_down: { type: Number, default: null },
    capacity_up: { type: Number, default: null },
    reserve_down: { type: Number, default: null },
    reserve_up: { type: Number, default: null },
    overhead_pct: { type: Number, default: null },
    caps: { type: [capSchema], default: [] },
  },
  { _id: false },
)

const balancerDownloaderSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    url: { type: String, default: "" },
    upper_down: { type: Number, default: null },
    upper_up: { type: Number, default: null },
    pending_restore: { type: Boolean, default: false },
    snapshot: { type: [String], default: [] },
  },
  { _id: false },
)

const networkBalancerSchema = new mongoose.Schema<NetworkBalancerType>({
  enabled: { type: Boolean, default: false },
  enabled_at: { type: String, default: null },
  disabled_reason: { type: String, default: null },
  disabled_at: { type: String, default: null },
  takeover_in_progress: { type: Boolean, default: false },
  takeover_at: { type: String, default: null },
  changes: { type: [String], default: [] },
  config: { type: configSchema, default: () => ({}) },
  downloaders: { type: [balancerDownloaderSchema], default: [] },
  last_capacity_down: { type: Number, default: null },
  last_capacity_up: { type: Number, default: null },
  updated_at: { type: String, default: () => moment().format() },
})

const NetworkBalancer = mongoose.model<NetworkBalancerType>("NetworkBalancer", networkBalancerSchema)

export default NetworkBalancer
