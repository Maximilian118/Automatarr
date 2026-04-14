import React from "react"
import { ResponsiveLine, PointTooltipProps } from "@nivo/line"
import { useTheme, useMediaQuery } from "@mui/material"
import { NivoLineData } from "../../../../types/statsType"
import { getChartTheme } from "../../../../shared/statsUtilities"
import "./_line.scss"

// Default tooltip shown on chart point hover
const ChartTooltip: React.FC<PointTooltipProps> = ({ point }) => (
  <div className="graph-card" style={{ width: "auto" }}>
    <div style={{ color: point.serieColor, fontWeight: "bold" }}>
      {point.serieId}: {point.data.yFormatted}
    </div>
  </div>
)

interface LineProps {
  data: NivoLineData[]
  maxValue: number
  yAxisLabel?: string
  yAxisFormat?: (value: number) => string
  yAxisTickValues?: number[]
  tooltip?: React.FC<PointTooltipProps>
  tickCount?: number
}

// Responsive line chart with sensible defaults for axis configuration and theming
const Line: React.FC<LineProps> = ({
  data,
  maxValue,
  yAxisLabel = "Count",
  yAxisFormat,
  yAxisTickValues,
  tooltip = ChartTooltip,
  tickCount = 4,
}) => {
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down("md"))

  return (
    <div className="line-chart-container">
      <ResponsiveLine
        data={data}
        margin={{
          top: 50,
          right: 30,
          bottom: 50,
          left: yAxisFormat ? 80 : 60,
        }}
        xScale={{ type: "point" }}
        yScale={{
          type: "linear",
          min: 0,
          max: maxValue,
          stacked: false,
          reverse: false,
        }}
        curve="monotoneX"
        axisTop={null}
        axisRight={null}
        axisBottom={{
          tickSize: 5,
          tickPadding: 5,
          tickRotation: isMobile ? -45 : 0,
          tickValues: tickCount,
          legend: "Day",
          legendOffset: 36,
          legendPosition: "middle",
        }}
        axisLeft={{
          tickSize: 5,
          tickPadding: 5,
          tickRotation: 0,
          legend: yAxisLabel,
          legendOffset: yAxisFormat ? -70 : -50,
          legendPosition: "middle",
          format: yAxisFormat as ((value: number) => string) | undefined,
          tickValues: yAxisTickValues,
        }}
        colors={{ datum: "color" }}
        pointSize={0}
        enablePoints={false}
        useMesh={true}
        tooltip={tooltip}
        legends={[]}
        theme={getChartTheme(theme)}
      />
    </div>
  )
}

export default Line
