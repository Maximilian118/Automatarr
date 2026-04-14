import React from "react"
import { Tooltip } from "@mui/material"
import "./_segment_bar.scss"

export type Segment = {
  value: number
  color: string
  label: string
  align?: "left" | "center" | "right"
}

interface SegmentBarProps {
  segments: Segment[]
  total?: number
  showLabels?: boolean
  labelThreshold?: number
  tooltip?: boolean
}

// A generic horizontal bar divided into colored segments proportional to their values
const SegmentBar: React.FC<SegmentBarProps> = ({
  segments,
  total: totalProp,
  showLabels = true,
  labelThreshold = 0.15,
  tooltip = true,
}) => {
  // Use provided total or sum of all segment values
  const total = totalProp ?? segments.reduce((sum, s) => sum + s.value, 0)

  // Render an empty bar when there's no data
  if (total <= 0) return <div className="segment-bar segment-bar-empty" />

  // Filter to segments that have a value
  const activeSegments = segments.filter((s) => s.value > 0)

  // Build the tooltip content with colored dots, labels, and values
  const tooltipContent = (
    <div className="segment-bar-tooltip-content">
      {segments.map((segment, i) => (
        <div className="segment-bar-tooltip-row" key={i}>
          <span className="segment-bar-tooltip-dot" style={{ background: segment.color }} />
          <span className="segment-bar-tooltip-label">{segment.label}</span>
          <span className="segment-bar-tooltip-value">{segment.value}/{total}</span>
        </div>
      ))}
    </div>
  )

  // Build the bar element
  const bar = (
    <div className="segment-bar">
      {activeSegments.map((segment, i) => {
        const fraction = segment.value / total
        const isFirst = i === 0
        const isLast = i === activeSegments.length - 1
        const isSolo = activeSegments.length === 1

        // Determine border-radius based on position
        let borderRadius = "0"
        if (isSolo) borderRadius = "4px"
        else if (isFirst) borderRadius = "4px 0 0 4px"
        else if (isLast) borderRadius = "0 4px 4px 0"

        return (
          <div
            key={i}
            className="segment-bar-section"
            style={{
              width: `${fraction * 100}%`,
              background: segment.color,
              borderRadius,
              textAlign: segment.align ?? "center",
            }}
          >
            {showLabels && fraction >= labelThreshold && (
              <span>{segment.value}</span>
            )}
          </div>
        )
      })}
    </div>
  )

  if (!tooltip) return bar

  return (
    <Tooltip
      arrow
      placement="top"
      slotProps={{
        tooltip: { className: "segment-bar-tooltip" },
        arrow: { className: "segment-bar-tooltip-arrow" },
      }}
      title={tooltipContent}
    >
      {bar}
    </Tooltip>
  )
}

export default SegmentBar
