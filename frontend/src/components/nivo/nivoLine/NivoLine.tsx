import React from "react"
import { ResponsiveLine } from '@nivo/line'
import { nivoData } from "../../../types/dataType"
import './_nivoLine.scss'
import { CircularProgress } from "@mui/material"
import { transformNivoData } from "../../../shared/utility"
import Legend from "./legend/Legend"

interface NivoLineType {
  title: string
  data: nivoData[]
  loading?: boolean
}

const NivoLine: React.FC<NivoLineType> = ({ title, data, loading }) => {
  // Legend colours
  const nivoColours = [
    '#ff8c00', // Orange
    '#f47560', // Coral
    '#e8c1a0', // Light Peach
    '#61c0bf', // Teal
    '#6c68fb', // Indigo
    '#b0e0e6', // Powder Blue
    '#ff69b4', // Hot Pink
  ]
  // Transform moment timestamps into something more friendly
  const nivoData = transformNivoData(data)
  // Check if all of the fields are 0
  const allData0 = data.every(d => d.data.every(d => d.y === 0))

  return (
    <div className="nivo-line">
      <h4>{title}</h4>
      {loading || data.length === 0 ? 
        <div className="spinner-centre">
          { data.length === 0 ? <h4>No Data</h4> : <CircularProgress/>}
        </div>
        :
        <>
          <ResponsiveLine
            data={nivoData}
            margin={{ top: 50, right: 40, bottom: 50, left: 50 }}
            xScale={{ type: 'point' }}
            yScale={{
              type: 'linear',
              min: allData0 ? 0 : 'auto',
              max: allData0 ? 10 : 'auto',
              stacked: true,
              reverse: false
            }}
            yFormat=" >-.2f"
            axisTop={null}
            axisRight={null}
            colors={nivoColours}
            pointSize={10}
            pointColor={{ theme: 'background' }}
            pointBorderWidth={2}
            pointBorderColor={{ from: 'serieColor' }}
            pointLabel="data.yFormatted"
            pointLabelYOffset={-12}
            enableTouchCrosshair={true}
            useMesh={true}
            tooltip={({ point }) => (
              <div className="tooltip">
                <strong>{`${point.serieId}: ${point.data.y}`}</strong>
              </div>
            )}
          />
          <Legend data={nivoData} colors={nivoColours}/>
        </>
      }
    </div>
  )
}

export default NivoLine
