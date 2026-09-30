import React from "react"
import "./_segment_bar.scss"

export type Segment = {
  value: number
  color: string
  label: string
}

interface SegmentBarProps {
  segments: Segment[]
  total?: number
}

// A horizontal bar split into proportional segments, with every segment named and counted underneath
// so the numbers are always readable without hovering
const SegmentBar: React.FC<SegmentBarProps> = ({ segments, total: totalProp }) => {
  // Use provided total or sum of all segment values
  const total = totalProp ?? segments.reduce((sum, s) => sum + s.value, 0)
  const activeSegments = segments.filter((s) => s.value > 0)

  return (
    <div className="segment-bar-wrap">
      <div className={`segment-bar${total <= 0 ? " segment-bar-empty" : ""}`} aria-hidden="true">
        {total > 0 && activeSegments.map((segment) => (
          <span
            key={segment.label}
            className="segment-bar-section"
            style={{ flexGrow: segment.value, background: segment.color }}
          />
        ))}
      </div>
      <dl className="segment-bar-legend">
        {segments.map((segment) => (
          <div key={segment.label}>
            <dt>
              <span className="segment-bar-swatch" style={{ background: segment.color }} aria-hidden="true" />
              {segment.label}
            </dt>
            <dd>{segment.value.toLocaleString()}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

export default SegmentBar
