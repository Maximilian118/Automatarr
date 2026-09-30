import React, { useContext, useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import { ArrowDownToLine, ArrowUpFromLine, CircleAlert, Clapperboard, HardDrive, OctagonX, RefreshCw, ShieldAlert, Tv, Users } from "lucide-react"
import AppContext from "../../context"
import Footer from "../../components/footer/Footer"
import PageHeader from "../../components/ui/PageHeader/PageHeader"
import StatTile from "../../components/ui/StatTile/StatTile"
import CenteredLoading from "../../components/utility/CenteredLoading/CenteredLoading"
import ReservoirTank from "../../components/dashboard/ReservoirTank/ReservoirTank"
import PosterRail from "../../components/dashboard/PosterRail/PosterRail"
import ChartCard from "../../components/charts/ChartCard/ChartCard"
import { getStats } from "../../shared/requests/statsRequests"
import { getRecentArrivals } from "../../shared/requests/dashboardRequests"
import { useAuthHandlers } from "../../shared/hooks/useAuthHandlers"
import { useThemeMode } from "../../shared/theme/useThemeMode"
import { StatsType } from "../../types/statsType"
import { Arrival } from "../../types/dashboardType"
import {
  buildLibraryTrend,
  buildStorageTrend,
  buildWindow,
  latestDay,
  latestStorage,
  netAdded,
  totalRemoved,
} from "../../shared/charts/dailyStats"
import { fixedUnitFormatter, formatCount, formatSize, storageTicks } from "../../shared/format"
import "./_dashboard.scss"

const WINDOW_DAYS = 30

// Show a signed change: "+12", "−3", "0"
const signed = (value: number | null): string => {
  if (value === null) return "–"
  if (value > 0) return `+${formatCount(value)}`
  if (value < 0) return `−${formatCount(Math.abs(value))}`
  return "0"
}

// The admin's overview: how full the drive is, what arrived, what was cleared, and how the library moved over 30 days
const Dashboard: React.FC = () => {
  const { user, setUser, loading, setLoading } = useContext(AppContext)
  const [stats, setStats] = useState<StatsType | null>(null)
  const [error, setError] = useState<string>("")
  const [arrivals, setArrivals] = useState<Arrival[]>([])
  const [arrivalsLoading, setArrivalsLoading] = useState<boolean>(true)
  const navigate = useNavigate()
  const auth = useAuthHandlers()
  const { tokens } = useThemeMode()

  // Fetch the recorded stats once on load
  useEffect(() => {
    if (!user.token) return
    getStats(setStats, user, setUser, setLoading, navigate).catch((err) =>
      setError(err instanceof Error ? err.message : "Failed to fetch stats"),
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Fetch the newest arrivals for the poster rail
  useEffect(() => {
    getRecentArrivals(20, auth)
      .then(setArrivals)
      .catch(() => setArrivals([]))
      .finally(() => setArrivalsLoading(false))
  }, [auth])

  const days = useMemo(() => buildWindow(stats?.data_points ?? [], WINDOW_DAYS), [stats])
  const latestPoint = stats?.data_points?.[stats.data_points.length - 1] ?? null
  const today = latestDay(days)
  const storage = latestStorage(days)

  const seriesColors = useMemo(
    () => ({ downloaded: tokens.seriesDownloaded, queued: tokens.seriesQueued, deleted: tokens.seriesDeleted }),
    [tokens],
  )
  const movieTrend = useMemo(() => buildLibraryTrend(days, "movies", seriesColors), [days, seriesColors])
  const seriesTrend = useMemo(() => buildLibraryTrend(days, "series", seriesColors), [days, seriesColors])
  const storageTrend = useMemo(() => buildStorageTrend(days, tokens.seriesDownloaded), [days, tokens])
  const storageFormat = useMemo(() => fixedUnitFormatter(storage?.total ?? 0), [storage])
  const storageAxis = useMemo(() => storageTicks(storage?.total ?? 0), [storage])

  const usedBytes = storage ? storage.total - storage.free : 0
  const usedFraction = storage && storage.total > 0 ? usedBytes / storage.total : 0
  const limitFraction = storage && storage.total > 0 && storage.minFree > 0 ? (storage.total - storage.minFree) / storage.total : null
  const belowLimit = !!storage && storage.minFree > 0 && storage.free < storage.minFree
  const removed = totalRemoved(days)
  const moviesAdded = netAdded(days, "movies")
  const seriesAdded = netAdded(days, "series")

  // Plain-language summaries read out in place of each chart
  const librarySummary = (kind: "movies" | "series") => {
    const now = today?.[kind].downloaded ?? 0
    const peak = Math.max(0, ...days.map((d) => d.stats?.[kind].queued ?? 0))
    const gone = days.reduce((t, d) => t + (d.stats?.[kind].deleted ?? 0), 0)
    return `${kind === "movies" ? "Movies" : "Series"} over the last ${WINDOW_DAYS} days: ${formatCount(now)} downloaded now, a queue peak of ${formatCount(peak)}, and ${formatCount(gone)} removed. Use Show table for every day.`
  }

  const header = (
    <PageHeader
      title="Dashboard"
      description="How full your drive is, what just arrived, and what Automatarr has cleared to make room."
    />
  )

  if (!stats && loading) {
    return (
      <main>
        {header}
        <CenteredLoading label="Loading stats" />
      </main>
    )
  }

  return (
    <main className="dashboard">
      {header}

      {error && (
        <div className="dashboard-error" role="alert">
          <CircleAlert aria-hidden="true" />
          <p>Stats couldn't be loaded: {error}</p>
        </div>
      )}

      {/* The reservoir: drive usage and the flow in and out */}
      <section className="dashboard-hero" aria-labelledby="dashboard-hero-title">
        <div className="dashboard-hero-tank">
          {storage ? (
            <ReservoirTank
              used={usedFraction}
              limit={limitFraction}
              label={`Drive ${Math.round(usedFraction * 100)}% full: ${formatSize(usedBytes)} of ${formatSize(storage.total)} used, ${formatSize(storage.free)} free.`}
            />
          ) : (
            <ReservoirTank used={0} label="No storage figures recorded yet." />
          )}
        </div>
        <div className="dashboard-hero-figures">
          <h2 id="dashboard-hero-title" className="visually-hidden">Storage</h2>
          {storage ? (
            <>
              <p className="dashboard-hero-used">
                <strong>{formatSize(usedBytes)}</strong>
                <span>used of {formatSize(storage.total)}</span>
              </p>
              <p className="dashboard-hero-free">{formatSize(storage.free)} free</p>
            </>
          ) : (
            <p className="dashboard-hero-free">Storage appears after Automatarr's first hourly check.</p>
          )}

          {belowLimit && storage && (
            <p className="dashboard-hero-warning">
              <ShieldAlert aria-hidden="true" />
              Free space is under {formatSize(storage.minFree)}, so new requests are paused until cleanups make room.
            </p>
          )}

          <dl className="dashboard-flow">
            <StatTile
              label={`Library change, last ${WINDOW_DAYS} days`}
              icon={<ArrowDownToLine aria-hidden="true" />}
              tone="inflow"
              value={signed(moviesAdded === null && seriesAdded === null ? null : (moviesAdded ?? 0) + (seriesAdded ?? 0))}
              detail={`${signed(moviesAdded)} movies, ${signed(seriesAdded)} series downloaded`}
            />
            <StatTile
              label={`Removed, last ${WINDOW_DAYS} days`}
              icon={<ArrowUpFromLine aria-hidden="true" />}
              tone="outflow"
              value={formatCount(removed)}
              detail="By cleanups and users"
            />
            {storage && storage.minFree > 0 && (
              <StatTile
                label="Requests pause below"
                icon={<HardDrive aria-hidden="true" />}
                tone="threshold"
                value={formatSize(storage.minFree)}
                detail="free space"
              />
            )}
          </dl>
        </div>
      </section>

      <PosterRail items={arrivals} loading={arrivalsLoading} />

      <div className="dashboard-charts">
        <ChartCard
          title="Movies"
          icon={<Clapperboard aria-hidden="true" />}
          headline={today ? <><strong>{formatCount(today.movies.downloaded)}</strong>downloaded of {formatCount(today.movies.library)} in Radarr</> : undefined}
          summary={librarySummary("movies")}
          days={days}
          series={movieTrend}
          formatValue={formatCount}
        />
        <ChartCard
          title="Series"
          icon={<Tv aria-hidden="true" />}
          headline={today ? <><strong>{formatCount(today.series.downloaded)}</strong>series, {formatCount(today.series.episodes)} episodes</> : undefined}
          summary={librarySummary("series")}
          days={days}
          series={seriesTrend}
          formatValue={formatCount}
        />
        <ChartCard
          title="Storage used"
          wide
          icon={<HardDrive aria-hidden="true" />}
          headline={storage ? <><strong>{Math.round(usedFraction * 100)}%</strong>of the drive</> : undefined}
          summary={storage
            ? `Storage used over the last ${WINDOW_DAYS} days, now ${formatSize(usedBytes)} of ${formatSize(storage.total)}. Use Show table for every day.`
            : "No storage figures yet."}
          days={days}
          series={storageTrend}
          formatValue={storageFormat}
          yMax={storage ? storageAxis.max : undefined}
          yTicks={storage ? storageAxis.ticks : undefined}
          markers={storage ? [
            { value: storage.total, label: "Capacity", tone: "muted" as const, labelAt: "right" as const },
            ...(storage.minFree > 0 ? [{ value: storage.total - storage.minFree, label: "Requests pause", tone: "threshold" as const, labelAt: "left" as const }] : []),
          ] : undefined}
        />
      </div>

      {latestPoint && (
        <section className="dashboard-system" aria-labelledby="dashboard-system-title">
          <h2 id="dashboard-system-title">Right now</h2>
          <dl className="dashboard-system-grid">
            <StatTile label="Failed downloads" icon={<OctagonX aria-hidden="true" />} tone={latestPoint.system.failed_downloads > 0 ? "outflow" : "neutral"} value={formatCount(latestPoint.system.failed_downloads)} detail="in the download queues" />
            <StatTile label="Blocked imports" icon={<ShieldAlert aria-hidden="true" />} tone={latestPoint.system.blocked_downloads > 0 ? "threshold" : "neutral"} value={formatCount(latestPoint.system.blocked_downloads)} detail="waiting on Queue Cleaner" />
            <StatTile label="Loops switched on" icon={<RefreshCw aria-hidden="true" />} value={`${formatCount(latestPoint.system.active_loops)} of 6`} />
            <StatTile label="People with pools" icon={<Users aria-hidden="true" />} value={formatCount(latestPoint.system.active_users)} />
          </dl>
        </section>
      )}

      <Footer />
    </main>
  )
}

export default Dashboard
