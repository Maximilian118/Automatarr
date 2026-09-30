import React from "react"
import { LoopStatus } from "../../../types/dashboardType"
import { formatFull, formatInterval, formatRelative } from "../../../shared/format"
import "./_loopStatusLine.scss"

interface LoopStatusLineProps {
  status?: LoopStatus
}

// Wrap a timestamp in <time> with its full date as a tooltip
const When: React.FC<{ iso: string }> = ({ iso }) => (
  <time dateTime={iso} title={formatFull(iso)}>{formatRelative(iso)}</time>
)

// When a loop last ran, when it runs next, and how much it removed in the past day
const LoopStatusLine: React.FC<LoopStatusLineProps> = ({ status }) => {
  if (!status) return null

  return (
    <dl className="loop-status-line">
      <div>
        <dt>Last run</dt>
        <dd>{status.running ? "Running now" : status.last_ran ? <When iso={status.last_ran} /> : "Not yet"}</dd>
      </div>
      <div>
        <dt>Next run</dt>
        <dd>
          {!status.active ? "Off" : status.running ? "After this run" : status.next_run ? <When iso={status.next_run} /> : formatInterval(status.interval_mins)}
        </dd>
      </div>
      <div>
        <dt>Removed today</dt>
        <dd>{status.deletions_24h.toLocaleString()}</dd>
      </div>
    </dl>
  )
}

export default LoopStatusLine
