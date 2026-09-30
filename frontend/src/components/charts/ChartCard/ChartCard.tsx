import React, { ReactNode, useId, useState } from "react"
import moment from "moment"
import { ChartLine, Table2 } from "lucide-react"
import TrendChart, { TrendMarker } from "../TrendChart/TrendChart"
import DataTable, { DataColumn } from "../../ui/DataTable/DataTable"
import { TrendSeries, WindowDay } from "../../../shared/charts/dailyStats"
import "./_chartCard.scss"

interface ChartCardProps {
  title: string
  icon?: ReactNode
  headline?: ReactNode
  summary: string
  days: WindowDay[]
  series: TrendSeries[]
  formatValue: (value: number) => string
  markers?: TrendMarker[]
  yMax?: number
  yTicks?: number[]
  wide?: boolean
}

interface TableRow {
  day: WindowDay
  index: number
}

// A titled chart with a legend and a switch to view the same numbers as a table
const ChartCard: React.FC<ChartCardProps> = ({ title, icon, headline, summary, days, series, formatValue, markers, yMax, yTicks, wide }) => {
  const [asTable, setAsTable] = useState(false)
  const titleId = useId()
  const hasData = days.some((d) => d.stats)

  // Newest day first in the table, skipping days with nothing recorded
  const rows: TableRow[] = days
    .map((day, index) => ({ day, index }))
    .filter((r) => r.day.stats)
    .reverse()

  const columns: DataColumn<TableRow>[] = [
    { key: "date", header: "Day", cell: (r) => moment(r.day.date).format("ddd D MMM") },
    ...series.map((s) => ({
      key: s.id,
      header: s.label,
      numeric: true,
      cell: (r: TableRow) => {
        const v = s.values[r.index]
        return v === null ? "–" : formatValue(v)
      },
    })),
  ]

  return (
    <section className={`chart-card${wide ? " chart-card-wide" : ""}`} aria-labelledby={titleId}>
      <div className="chart-card-header">
        <div className="chart-card-title">
          {icon}
          <h2 id={titleId}>{title}</h2>
        </div>
        {headline && <div className="chart-card-headline">{headline}</div>}
      </div>

      <div className="chart-card-controls">
        {series.length > 1 ? (
          <ul className="chart-card-legend" aria-label="Lines on this chart">
            {series.map((s) => (
              <li key={s.id}>
                <span className="chart-card-swatch" style={{ background: s.color }} aria-hidden="true" />
                {s.label}
              </li>
            ))}
          </ul>
        ) : <span />}
        {hasData && (
          <button
            type="button"
            className="chart-card-toggle"
            aria-pressed={asTable}
            onClick={() => setAsTable((v) => !v)}
          >
            {asTable ? <ChartLine aria-hidden="true" /> : <Table2 aria-hidden="true" />}
            {asTable ? "Show chart" : "Show table"}
          </button>
        )}
      </div>

      {!hasData ? (
        <p className="chart-card-empty">No data yet. Automatarr records a point every hour, so this fills in over the next day.</p>
      ) : asTable ? (
        <DataTable caption={`${title}, by day`} columns={columns} rows={rows} rowKey={(r) => r.day.key} />
      ) : (
        <div role="img" aria-label={summary}>
          <TrendChart days={days} series={series} formatValue={formatValue} markers={markers} yMax={yMax} yTicks={yTicks} wide={wide} />
        </div>
      )}
    </section>
  )
}

export default ChartCard
