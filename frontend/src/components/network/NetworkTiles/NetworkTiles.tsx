import React from "react"
import { ArrowDownUp, Gauge, Globe, House, Share2 } from "lucide-react"
import StatTile from "../../ui/StatTile/StatTile"
import { CapacitySource, NetworkStatus } from "../../../types/networkType"
import { formatRate } from "../../../shared/format"
import "./_networkTiles.scss"

interface NetworkTilesProps {
  status: NetworkStatus
}

// Where the ISP speed came from, in words
const sourceLabel: Record<CapacitySource, string> = {
  manual: "your figure below",
  plan: "your ISP plan in UniFi",
  speedtest: "UniFi's last speedtest",
  last: "the last known figure",
  none: "unknown",
}

// A whole-number percentage, or a dash when it isn't known
const percent = (value: number | null): string => (value === null ? "–" : `${Math.round(value)}%`)

// The figures the balancer works from: ISP speed, what's in use, household traffic and the clients' share
const NetworkTiles: React.FC<NetworkTilesProps> = ({ status }) => (
  <dl className="network-tiles">
    <StatTile
      label="ISP speed"
      icon={<Globe aria-hidden="true" />}
      value={formatRate(status.capacity.down)}
      detail={`${formatRate(status.capacity.up)} up, from ${sourceLabel[status.capacity_source_down]}`}
    />
    <StatTile
      label="Internet in use"
      icon={<Gauge aria-hidden="true" />}
      tone={(status.saturation.down ?? 0) > 90 ? "threshold" : "inflow"}
      value={status.unifi.connected ? formatRate(status.wan.down) : "–"}
      detail={
        status.unifi.connected
          ? `${percent(status.saturation.down)} of your download, ${formatRate(status.wan.up)} up`
          : "UniFi can't be reached"
      }
    />
    <StatTile
      label="Everything else"
      icon={<House aria-hidden="true" />}
      value={formatRate(status.household.down)}
      detail={`${formatRate(status.household.up)} up. Traffic that isn't a download client`}
    />
    <StatTile
      label="Download clients' share"
      icon={<Share2 aria-hidden="true" />}
      tone="good"
      value={formatRate(status.budget.down)}
      detail={`Of ${formatRate(status.hard.down)}, keeping ${formatRate(status.reserve.down)} free for everything else`}
    />
    <StatTile
      label="Upload share"
      icon={<ArrowDownUp aria-hidden="true" />}
      value={formatRate(status.budget.up)}
      detail={`Of ${formatRate(status.hard.up)}, keeping ${formatRate(status.reserve.up)} free`}
    />
  </dl>
)

export default NetworkTiles
