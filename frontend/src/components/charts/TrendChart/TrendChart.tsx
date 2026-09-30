import React, { useMemo } from "react"
import { ResponsiveLine, SliceTooltipProps } from "@nivo/line"
import { useMediaQuery } from "@mui/material"
import moment from "moment"
import { TrendSeries, WindowDay } from "../../../shared/charts/dailyStats"
import { useThemeMode } from "../../../shared/theme/useThemeMode"
import { createChartTheme } from "../../../shared/theme/chartTheme"
import "./_trendChart.scss"

export interface TrendMarker {
  value: number
  label: string
  tone: "threshold" | "muted"
  // Which end of the line the label sits at, so neighbouring markers don't collide
  labelAt?: "left" | "right"
}

interface TrendChartProps {
  days: WindowDay[]
  series: TrendSeries[]
  formatValue: (value: number) => string
  markers?: TrendMarker[]
  yMax?: number
  yTicks?: number[]
  wide?: boolean
}

// Tooltip listing every series for the hovered day
const DayTooltip = (formatValue: (value: number) => string) => {
  const Tooltip: React.FC<SliceTooltipProps> = ({ slice }) => (
    <div className="trend-tooltip">
      <p className="trend-tooltip-date">{moment(slice.points[0]?.data.x as Date).format("ddd D MMM")}</p>
      <ul>
        {slice.points.map((point) => (
          <li key={point.id}>
            <span className="trend-tooltip-swatch" style={{ background: point.serieColor }} aria-hidden="true" />
            <span className="trend-tooltip-label">{point.serieId}</span>
            <span className="trend-tooltip-value">{formatValue(Number(point.data.y))}</span>
          </li>
        ))}
      </ul>
    </div>
  )
  return Tooltip
}

// A time-scale line chart over the day window. Gaps in collection stay visible as breaks in the line
const TrendChart: React.FC<TrendChartProps> = ({ days, series, formatValue, markers = [], yMax, yTicks, wide }) => {
  const { tokens } = useThemeMode()
  const narrow = useMediaQuery("(max-width: 599px)")

  const data = useMemo(
    () =>
      series.map((s) => ({
        id: s.label,
        color: s.color,
        data: days.map((day, i) => ({ x: day.date, y: s.values[i] })),
      })),
    [series, days],
  )

  const tooltip = useMemo(() => DayTooltip(formatValue), [formatValue])

  return (
    <div className="trend-chart">
      <ResponsiveLine
        data={data}
        role="presentation"
        margin={{ top: 16, right: 16, bottom: 36, left: 72 }}
        xScale={{ type: "time", format: "native", precision: "day", useUTC: false }}
        xFormat="time:%d %b"
        yScale={{ type: "linear", min: 0, max: yMax ?? "auto", nice: true }}
        curve="monotoneX"
        lineWidth={2}
        colors={{ datum: "color" }}
        enablePoints={false}
        enableGridX={false}
        gridYValues={yTicks ?? 5}
        axisTop={null}
        axisRight={null}
        axisBottom={{
          format: "%d %b",
          tickValues: narrow ? "every 7 days" : wide ? "every 3 days" : "every 5 days",
          tickSize: 0,
          tickPadding: 10,
        }}
        axisLeft={{
          tickValues: yTicks ?? 5,
          tickSize: 0,
          tickPadding: 10,
          format: (v) => formatValue(Number(v)),
        }}
        markers={markers.map((m) => ({
          axis: "y" as const,
          value: m.value,
          legend: m.label,
          legendPosition: m.labelAt === "right" ? ("top-right" as const) : ("bottom-left" as const),
          legendOffsetX: 8,
          legendOffsetY: 6,
          legendOrientation: "horizontal" as const,
          lineStyle: {
            stroke: m.tone === "threshold" ? tokens.threshold : tokens.inkMuted,
            strokeWidth: 2,
            strokeDasharray: "6 4",
          },
          textStyle: {
            fill: m.tone === "threshold" ? tokens.threshold : tokens.inkMuted,
            fontSize: 13,
            fontWeight: 700,
          },
        }))}
        enableSlices="x"
        sliceTooltip={tooltip}
        enableTouchCrosshair
        crosshairType="x"
        legends={[]}
        theme={createChartTheme(tokens)}
        animate={false}
      />
    </div>
  )
}

export default TrendChart
