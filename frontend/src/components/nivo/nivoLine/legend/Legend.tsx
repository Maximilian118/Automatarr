import React from "react"
import { nivoData } from "../../../../types/dataType"
import './_legend.scss'

interface LegendType {
  data: nivoData[]
  colors: string[]
}

const Legend: React.FC<LegendType> = ({ data, colors }) => {
  return (
    <div className="legend">
      {data.map((d, i) => (
        <div key={d.id} className="data-point">
          <div className="color-circle" style={{ background: colors[i] }}/>
          <p>{d.id}</p>
        </div>
      ))}
    </div>
  )
}

export default Legend
