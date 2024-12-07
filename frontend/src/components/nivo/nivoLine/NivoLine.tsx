import React from "react"
import { ResponsiveLine } from '@nivo/line'
import { nivoData } from "../../../types/dataType"
import './_nivoLine.scss'
import { CircularProgress } from "@mui/material"

interface NivoLineType {
  title: string
  data: nivoData[]
  loading?: boolean
}

const NivoLine: React.FC<NivoLineType> = ({ title, data, loading }) => {
  return (
    <div className="nivo-line">
      <h4>{title}</h4>
      {loading ? 
        <div className="spinner-centre">
          <CircularProgress/>
        </div>
        : 
        <ResponsiveLine
          data={data}
          margin={{ top: 50, right: 20, bottom: 70, left: 20 }}
          xScale={{ type: 'point' }}
          yScale={{
            type: 'linear',
            min: 'auto',
            max: 'auto',
            stacked: true,
            reverse: false
          }}
          yFormat=" >-.2f"
          axisTop={null}
          axisRight={null}
          axisLeft={{
              tickSize: 5,
              tickPadding: 5,
              tickRotation: 0,
              legend: 'Count',
              legendOffset: -40,
              legendPosition: 'middle',
              truncateTickAt: 0
          }}
          colors={{ scheme: 'nivo' }}
          enablePoints={false}
          pointSize={10}
          pointColor={{ theme: 'background' }}
          pointBorderWidth={2}
          pointBorderColor={{ from: 'serieColor' }}
          pointLabel="data.yFormatted"
          pointLabelYOffset={-12}
          enableTouchCrosshair={true}
          useMesh={true}
          legends={[
            {
              anchor: 'bottom-left',
              direction: 'row',
              justify: false,
              translateX: -20,
              translateY: 60,
              itemsSpacing: 0,
              itemDirection: 'left-to-right',
              itemWidth: 80,
              itemHeight: 20,
              itemOpacity: 0.75,
              symbolSize: 12,
              symbolShape: 'circle',
              symbolBorderColor: 'rgba(0, 0, 0, .5)',
              effects: [
                {
                  on: 'hover',
                  style: {
                    itemBackground: 'rgba(0, 0, 0, .03)',
                    itemOpacity: 1
                  }
                }
              ]
            }
          ]}
        />
      }
    </div>
  )
}

export default NivoLine
