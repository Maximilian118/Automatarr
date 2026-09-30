import moment from "moment"
import { StatsDataPoint } from "../../types/statsType"

// One calendar day of stats, reduced from the roughly hourly data points recorded that day
export interface DailyStats {
  key: string
  date: Date
  movies: { downloaded: number; queued: number; deleted: number; library: number }
  series: { downloaded: number; queued: number; deleted: number; episodes: number; episodesDeleted: number }
  storage: { total: number; free: number; minFree: number } | null
}

// A day in the chart window. Days with no recorded data stay in the window as gaps (stats = null)
export interface WindowDay {
  key: string
  date: Date
  stats: DailyStats | null
}

// One line on a trend chart. Values line up with the window's days; null breaks the line
export interface TrendSeries {
  id: string
  label: string
  color: string
  values: (number | null)[]
}

const DAY_FORMAT = "YYYY-MM-DD"

// Reduce the points recorded on one day. Library sizes take the day's last value,
// queues take the day's peak, and deletions (recorded per hour) are summed
const reduceDay = (key: string, points: StatsDataPoint[]): DailyStats => {
  const sorted = [...points].sort((a, b) => moment(a.timestamp).valueOf() - moment(b.timestamp).valueOf())
  const last = sorted[sorted.length - 1]
  const lastWithStorage = [...sorted].reverse().find((p) => Number(p.storage?.total_storage_size) > 0)
  const sum = (pick: (p: StatsDataPoint) => number) => sorted.reduce((total, p) => total + (Number(pick(p)) || 0), 0)
  const max = (pick: (p: StatsDataPoint) => number) => sorted.reduce((peak, p) => Math.max(peak, Number(pick(p)) || 0), 0)

  return {
    key,
    date: moment(key, DAY_FORMAT).toDate(),
    movies: {
      downloaded: Number(last.movies.downloaded) || 0,
      queued: max((p) => p.movies.queued),
      deleted: sum((p) => p.movies.deleted),
      library: Number(last.movies.total_library_size) || 0,
    },
    series: {
      downloaded: Number(last.series.downloaded) || 0,
      queued: max((p) => p.series.queued),
      deleted: sum((p) => p.series.deleted),
      episodes: Number(last.series.episodes_downloaded) || 0,
      episodesDeleted: sum((p) => p.series.episodes_deleted),
    },
    storage: lastWithStorage
      ? {
          total: Number(lastWithStorage.storage.total_storage_size),
          free: Number(lastWithStorage.storage.free_storage),
          minFree: Number(lastWithStorage.storage.minimum_free_storage) || 0,
        }
      : null,
  }
}

// The last `days` calendar days (today included), each with its reduced stats or null when nothing was recorded
export const buildWindow = (points: StatsDataPoint[], days = 30, now: Date = new Date()): WindowDay[] => {
  const byDay = new Map<string, StatsDataPoint[]>()

  points.forEach((point) => {
    const key = moment(point.timestamp).format(DAY_FORMAT)
    const bucket = byDay.get(key)
    if (bucket) bucket.push(point)
    else byDay.set(key, [point])
  })

  const today = moment(now).startOf("day")

  return Array.from({ length: days }, (_, i) => {
    const day = today.clone().subtract(days - 1 - i, "days")
    const key = day.format(DAY_FORMAT)
    const dayPoints = byDay.get(key)
    return { key, date: day.toDate(), stats: dayPoints ? reduceDay(key, dayPoints) : null }
  })
}

// Pull one value per day out of the window, leaving gaps where a day has no data
const valuesFor = (days: WindowDay[], pick: (s: DailyStats) => number | null): (number | null)[] =>
  days.map((day) => (day.stats ? pick(day.stats) : null))

export interface SeriesColors {
  downloaded: string
  queued: string
  deleted: string
}

// Downloaded, peak queue and removed per day for movies or series
export const buildLibraryTrend = (days: WindowDay[], kind: "movies" | "series", colors: SeriesColors): TrendSeries[] => [
  { id: "downloaded", label: "Downloaded", color: colors.downloaded, values: valuesFor(days, (s) => s[kind].downloaded) },
  { id: "queued", label: "Queued (daily peak)", color: colors.queued, values: valuesFor(days, (s) => s[kind].queued) },
  { id: "deleted", label: "Removed that day", color: colors.deleted, values: valuesFor(days, (s) => s[kind].deleted) },
]

// Storage in use per day
export const buildStorageTrend = (days: WindowDay[], color: string): TrendSeries[] => [
  {
    id: "used",
    label: "Used",
    color,
    values: valuesFor(days, (s) => (s.storage ? s.storage.total - s.storage.free : null)),
  },
]

// The most recent day that has data
export const latestDay = (days: WindowDay[]): DailyStats | null =>
  [...days].reverse().find((d) => d.stats)?.stats ?? null

// The most recent day that has storage figures
export const latestStorage = (days: WindowDay[]): DailyStats["storage"] =>
  [...days].reverse().find((d) => d.stats?.storage)?.stats?.storage ?? null

// Total removed across the days for movies and series
export const totalRemoved = (days: WindowDay[]): number =>
  days.reduce((total, d) => total + (d.stats ? d.stats.movies.deleted + d.stats.series.deleted : 0), 0)

// How many more titles have files now than on the first day with data in the days
export const netAdded = (days: WindowDay[], kind: "movies" | "series"): number | null => {
  const withData = days.filter((d) => d.stats)
  if (withData.length < 2) return null
  const first = withData[0].stats as DailyStats
  const last = withData[withData.length - 1].stats as DailyStats
  return last[kind].downloaded - first[kind].downloaded
}
