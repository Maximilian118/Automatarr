import React from "react"
import { ListChecks } from "lucide-react"
import InputPanel from "../../panel/inputPanel/InputPanel"
import { noticeIcons } from "../../ui/Notice/noticeIcons"
import { NetworkEvent } from "../../../types/networkType"
import { formatFull, formatWhen } from "../../../shared/format"
import "./_balancerEvents.scss"

interface BalancerEventsProps {
  events: NetworkEvent[]
}

const levelNames = { info: "Information", warn: "Warning", error: "Error" }

// What the balancer has done and noticed since Automatarr started, newest first
const BalancerEvents: React.FC<BalancerEventsProps> = ({ events }) => (
  <InputPanel title="Recent activity" startIcon={<ListChecks aria-hidden="true" />}>
    {events.length === 0 ? (
      <p className="balancer-events-empty">Nothing yet. Turning the balancer on, off, and anything it fixes shows up here.</p>
    ) : (
      <ol className="balancer-events">
        {events.map((e) => {
          const Icon = noticeIcons[e.level]
          return (
            <li key={`${e.at}-${e.message}`} className={`balancer-event balancer-event-${e.level}`}>
              <Icon aria-label={levelNames[e.level]} />
              <time dateTime={e.at} title={formatFull(e.at)}>{formatWhen(e.at)}</time>
              <span>{e.message}</span>
            </li>
          )
        })}
      </ol>
    )}
  </InputPanel>
)

export default BalancerEvents
