import React, { ReactNode } from "react"
import "./_statTile.scss"

export type StatTone = "neutral" | "inflow" | "outflow" | "threshold" | "good"

interface StatTileProps {
  label: string
  value: ReactNode
  detail?: ReactNode
  icon?: ReactNode
  tone?: StatTone
}

// A single labelled figure. Tone colours the icon only; the value stays in ink so meaning never relies on colour
const StatTile: React.FC<StatTileProps> = ({ label, value, detail, icon, tone = "neutral" }) => (
  <div className={`stat-tile stat-tile-${tone}`}>
    <dt className="stat-tile-label">
      {icon && <span className="stat-tile-icon">{icon}</span>}
      {label}
    </dt>
    <dd className="stat-tile-value">{value}</dd>
    {detail && <dd className="stat-tile-detail">{detail}</dd>}
  </div>
)

export default StatTile
