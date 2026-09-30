import React, { useId } from "react"
import "./_reservoirTank.scss"

interface ReservoirTankProps {
  // Fraction of the drive in use, 0 to 1
  used: number
  // Fraction of the drive at which bot downloads pause (capacity minus minimum free space), 0 to 1
  limit?: number | null
  label: string
}

// Tank geometry in SVG units
const TANK = { x: 12, y: 12, w: 156, h: 236, r: 26 }
const WAVE_PERIOD = TANK.w / 3
const WAVE_AMPLITUDE = 5

// A closed water shape: a periodic wave along the surface, filled down to the tank floor.
// It is twice the tank's width so shifting it by one tank width loops seamlessly
const waterPath = (levelY: number): string => {
  const startX = TANK.x - TANK.w
  const halfPeriods = Math.round((TANK.w * 2) / (WAVE_PERIOD / 2))
  let d = `M ${startX} ${levelY} q ${WAVE_PERIOD / 4} ${-WAVE_AMPLITUDE} ${WAVE_PERIOD / 2} 0`

  for (let i = 1; i < halfPeriods; i++) {
    d += ` t ${WAVE_PERIOD / 2} 0`
  }

  return `${d} V ${TANK.y + TANK.h + 4} H ${startX} Z`
}

// The dashboard's hero: the drive drawn as a tank, filled to how much is in use,
// with the line where requests pause. The water rises once on load and the surface settles within a few seconds
const ReservoirTank: React.FC<ReservoirTankProps> = ({ used, limit, label }) => {
  const clipId = useId()
  const gradientId = useId()
  const clampedUsed = Math.min(Math.max(used, 0), 1)
  const levelY = TANK.y + TANK.h * (1 - clampedUsed)
  const limitY = limit !== null && limit !== undefined ? TANK.y + TANK.h * (1 - Math.min(Math.max(limit, 0), 1)) : null
  const graduations = [0.25, 0.5, 0.75]

  return (
    <svg className="reservoir-tank" viewBox="0 0 320 260" role="img" aria-label={label}>
      <defs>
        <clipPath id={clipId}>
          <rect x={TANK.x} y={TANK.y} width={TANK.w} height={TANK.h} rx={TANK.r} />
        </clipPath>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" className="tank-water-top" />
          <stop offset="100%" className="tank-water-deep" />
        </linearGradient>
      </defs>

      {/* Tank body */}
      <rect className="tank-body" x={TANK.x} y={TANK.y} width={TANK.w} height={TANK.h} rx={TANK.r} />

      {/* Water, clipped to the tank */}
      <g clipPath={`url(#${clipId})`}>
        <g className="tank-water-rise">
          <path className="tank-water" d={waterPath(levelY)} fill={`url(#${gradientId})`} />
        </g>
        {graduations.map((g) => (
          <line
            key={g}
            className="tank-graduation"
            x1={TANK.x}
            x2={TANK.x + 14}
            y1={TANK.y + TANK.h * (1 - g)}
            y2={TANK.y + TANK.h * (1 - g)}
          />
        ))}
      </g>

      {/* Tank outline drawn last so it sits over the water */}
      <rect className="tank-outline" x={TANK.x} y={TANK.y} width={TANK.w} height={TANK.h} rx={TANK.r} />

      {/* Where downloads pause */}
      {limitY !== null && (
        <g className="tank-limit">
          <line x1={TANK.x - 6} x2={TANK.x + TANK.w + 6} y1={limitY} y2={limitY} />
          <text x={TANK.x + TANK.w + 14} y={limitY + 5}>Requests pause</text>
        </g>
      )}

      {/* Current level marker */}
      <g className="tank-level">
        <line x1={TANK.x + TANK.w + 2} x2={TANK.x + TANK.w + 10} y1={levelY} y2={levelY} />
        <text x={TANK.x + TANK.w + 14} y={levelY + (limitY !== null && Math.abs(limitY - levelY) < 22 ? 22 : 5)}>
          {Math.round(clampedUsed * 100)}% full
        </text>
      </g>
    </svg>
  )
}

export default ReservoirTank
