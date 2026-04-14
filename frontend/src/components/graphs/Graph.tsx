import React from "react"
import { useTheme, useMediaQuery } from "@mui/material"
import "./_graph.scss"

interface GraphProps {
  title: string
  icon: string
  subtitle?: string
  legendItems?: { label: string; color: string }[]
  children: React.ReactNode
}

// Reusable graph wrapper providing card background, header with icon/title/subtitle, and legend
const Graph: React.FC<GraphProps> = ({
  title,
  icon,
  subtitle,
  legendItems,
  children,
}) => {
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('md'))

  return (
  <div
    className={`graph-card ${isMobile ? 'graph-card-mobile' : ''}`}
  >
    {/* Header with icon, title, subtitle, and legend */}
    <div className="graph-header">
      <div className="graph-title">
        {icon.startsWith('http') ? (
          <img src={icon} alt={title} />
        ) : (
          <span className="graph-emoji">{icon}</span>
        )}
        <h6>
          {title}
          {subtitle && <span className="graph-subtitle">: {subtitle}</span>}
        </h6>
      </div>
      {legendItems && legendItems.length > 0 && (
        <div className="graph-legend">
          {legendItems.map(item => (
            <div key={item.label} className="graph-legend-item">
              <span className="graph-legend-dot" style={{ backgroundColor: item.color }} />
              <span className="graph-legend-label">{item.label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
    {children}
  </div>
  )
}

export default Graph
