import React, { useId, useMemo } from "react"
import { ResponsiveLine, SliceTooltipProps } from "@nivo/line"
import moment from "moment"
import { ChartLine } from "lucide-react"
import { NetworkDownloader, NetworkSample } from "../../../types/networkType"
import { useThemeMode } from "../../../shared/theme/useThemeMode"
import { createChartTheme } from "../../../shared/theme/chartTheme"
import { formatRate } from "../../../shared/format"
import "./_liveBandwidthChart.scss"

interface LiveBandwidthChartProps {
  history: NetworkSample[]
  downloaders: NetworkDownloader[]
}

type ChartSeries = { id: string; color: string; values: (s: NetworkSample) => number }

// Tooltip listing every line at the hovered moment
const SampleTooltip: React.FC<SliceTooltipProps> = ({ slice }) => (
  <div className="live-chart-tooltip">
    <p className="live-chart-tooltip-time">{moment(slice.points[0]?.data.x as Date).format("HH:mm:ss")}</p>
    <ul>
      {slice.points.map((point) => (
        <li key={point.id}>
          <span className="live-chart-swatch" style={{ background: point.serieColor }} aria-hidden="true" />
          <span className="live-chart-tooltip-label">{point.serieId}</span>
          <span className="live-chart-tooltip-value">{formatRate(Number(point.data.y))}</span>
        </li>
      ))}
    </ul>
  </div>
)

// The last 30 minutes of internet traffic: total, everything else, each download client and their share
const LiveBandwidthChart: React.FC<LiveBandwidthChartProps> = ({ history, downloaders }) => {
  const { tokens } = useThemeMode()
  const titleId = useId()

  const series: ChartSeries[] = useMemo(() => {
    const clientColors = [tokens.seriesDownloaded, tokens.seriesQueued, tokens.seriesDeleted]

    return [
      { id: "Internet in use", color: tokens.accent, values: (s) => s.wan_down },
      { id: "Everything else", color: tokens.threshold, values: (s) => s.household_down },
      ...downloaders.map((d, i) => ({
        id: d.label,
        color: clientColors[i % clientColors.length],
        values: (s: NetworkSample) => s.downloaders.find((x) => x.name === d.name)?.down ?? 0,
      })),
      { id: "Clients' share", color: tokens.inkMuted, values: (s) => s.budget_down },
    ]
  }, [tokens, downloaders])

  const data = useMemo(
    () =>
      series.map((s) => ({
        id: s.id,
        color: s.color,
        data: history.map((sample) => ({ x: new Date(sample.at), y: s.values(sample) })),
      })),
    [series, history],
  )

  const latest = history[history.length - 1]
  const summary = latest
    ? `Internet traffic over the last ${history.length} readings. Now ${formatRate(latest.wan_down)} in use, ${formatRate(latest.household_down)} of it not from a download client.`
    : "No readings yet."

  return (
    <section className="live-chart" aria-labelledby={titleId}>
      <div className="live-chart-title">
        <ChartLine aria-hidden="true" />
        <h2 id={titleId}>Download traffic</h2>
      </div>
      <ul className="live-chart-legend" aria-label="Lines on this chart">
        {series.map((s) => (
          <li key={s.id}>
            <span className="live-chart-swatch" style={{ background: s.color }} aria-hidden="true" />
            {s.id}
          </li>
        ))}
      </ul>
      {history.length < 2 ? (
        <p className="live-chart-empty">The chart fills in every 10 seconds while this page is open or the balancer is on.</p>
      ) : (
        <div className="live-chart-plot" role="img" aria-label={summary}>
          <ResponsiveLine
            data={data}
            role="presentation"
            margin={{ top: 16, right: 16, bottom: 36, left: 80 }}
            xScale={{ type: "time", format: "native", precision: "second", useUTC: false }}
            yScale={{ type: "linear", min: 0, max: "auto", nice: true }}
            curve="monotoneX"
            lineWidth={2}
            colors={{ datum: "color" }}
            enablePoints={false}
            enableGridX={false}
            axisTop={null}
            axisRight={null}
            axisBottom={{ format: "%H:%M", tickValues: 5, tickSize: 0, tickPadding: 10 }}
            axisLeft={{ tickValues: 5, tickSize: 0, tickPadding: 10, format: (v) => formatRate(Number(v)) }}
            enableSlices="x"
            sliceTooltip={SampleTooltip}
            enableTouchCrosshair
            crosshairType="x"
            theme={createChartTheme(tokens)}
            animate={false}
          />
        </div>
      )}
    </section>
  )
}

export default LiveBandwidthChart
