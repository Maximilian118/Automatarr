import React from "react"
import "./nivo-legend.scss"

export interface NivoLegendItem {
  id: string
  label: string
  color: string
}

interface NivoLegendProps {
  data: NivoLegendItem[]
  direction?: 'row' | 'column'
  justify?: boolean
  itemsSpacing?: number
  itemWidth?: number
  itemHeight?: number
  itemDirection?: 'left-to-right' | 'right-to-left'
  itemOpacity?: number
  symbolSize?: number
  symbolShape?: 'circle' | 'square' | 'triangle' | 'diamond'
  translateX?: number
  translateY?: number
  className?: string
}

const NivoLegend: React.FC<NivoLegendProps> = ({
  data,
  direction = 'row',
  itemsSpacing = 32,
  itemWidth = 120,
  itemHeight = 20,
  itemDirection = 'left-to-right',
  itemOpacity = 0.85,
  symbolSize = 14,
  symbolShape = 'circle',
  translateX = 0,
  translateY = 0,
  className = ''
}) => {
  const renderSymbol = (color: string) => {
    const baseProps = {
      width: symbolSize,
      height: symbolSize,
      fill: color,
      opacity: itemOpacity
    }

    switch (symbolShape) {
      case 'square':
        return <rect {...baseProps} />
      case 'triangle': {
        const points = `${symbolSize/2},0 ${symbolSize},${symbolSize} 0,${symbolSize}`
        return <polygon points={points} fill={color} opacity={itemOpacity} />
      }
      case 'diamond': {
        const diamondPoints = `${symbolSize/2},0 ${symbolSize},${symbolSize/2} ${symbolSize/2},${symbolSize} 0,${symbolSize/2}`
        return <polygon points={diamondPoints} fill={color} opacity={itemOpacity} />
      }
      case 'circle':
      default:
        return <circle cx={symbolSize/2} cy={symbolSize/2} r={symbolSize/2} {...baseProps} />
    }
  }

  return (
    <div 
      className={`nivo-legend ${className}`}
      style={{
        transform: `translate(${translateX}px, ${translateY}px)`,
        flexDirection: direction,
        justifyContent: "center",
        gap: `${itemsSpacing}px`
      }}
    >
      {data.map((item) => (
        <div
          key={item.id}
          className={`nivo-legend-item ${itemDirection}`}
          style={{
            width: itemWidth,
            height: itemHeight,
            opacity: itemOpacity
          }}
        >
          <div className="nivo-legend-symbol">
            <svg width={symbolSize} height={symbolSize}>
              {renderSymbol(item.color)}
            </svg>
          </div>
          <span className="nivo-legend-text">{item.label}</span>
        </div>
      ))}
    </div>
  )
}

export default NivoLegend