import React, { useId } from "react"
import { Download, Newspaper } from "lucide-react"
import { NetworkDownloader } from "../../../types/networkType"
import { formatRate } from "../../../shared/format"
import "./_downloaderCard.scss"

interface DownloaderCardProps {
  downloader: NetworkDownloader
  enabled: boolean // The balancer is running, so the target is what it's setting rather than what it would set
}

// What the client is doing, in words
const stateLabel = (d: NetworkDownloader): { text: string; tone: string } => {
  if (!d.reachable) return { text: "Can't be reached", tone: "bad" }
  if (d.paused) return { text: "Paused", tone: "muted" }
  if (d.active) return { text: d.hungry ? "Downloading, could go faster" : "Downloading", tone: "good" }
  return { text: "Idle", tone: "muted" }
}

// One download client: its speed, its limit now, what the balancer wants for it, and its fixed split
const DownloaderCard: React.FC<DownloaderCardProps> = ({ downloader: d, enabled }) => {
  const headingId = useId()
  const state = stateLabel(d)
  const Icon = d.name === "sabnzbd" ? Newspaper : Download

  // One labelled row with a download figure and, for clients that upload, an upload figure
  const row = (label: string, down: number | null, up: number | null) => (
    <div className="downloader-card-row">
      <dt>{label}</dt>
      <dd>
        {formatRate(down)}
        {d.supports_upload && <span className="downloader-card-up">{formatRate(up)} up</span>}
      </dd>
    </div>
  )

  return (
    <section className="downloader-card" aria-labelledby={headingId}>
      <div className="downloader-card-top">
        <Icon aria-hidden="true" />
        <h3 id={headingId}>{d.label}</h3>
        <span className={`downloader-card-state downloader-card-state-${state.tone}`}>{state.text}</span>
      </div>
      {d.error && <p className="downloader-card-error">{d.error}</p>}
      <dl>
        {row("Speed now", d.speed_down, d.speed_up)}
        {row("Limit now", d.limit_down, d.limit_up)}
        {row(enabled ? "Balancer target" : "Would be set to", d.target_down, d.target_up)}
        {row("Fixed split", d.baseline_down, d.baseline_up)}
      </dl>
      {d.pending_restore && (
        <p className="downloader-card-note">
          Waiting to be put back on its fixed split. Automatarr keeps trying until it can reach {d.label}.
        </p>
      )}
    </section>
  )
}

export default DownloaderCard
