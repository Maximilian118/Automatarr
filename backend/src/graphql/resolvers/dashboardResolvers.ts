import { AuthRequest, requireAuth } from "../../middleware/auth"
import Activity from "../../models/activity"
import Data, { dataType, LoopData } from "../../models/data"
import Settings, { settingsType } from "../../models/settings"
import { loopRunTimes } from "../../shared/dynamicLoop"
import { Movie } from "../../types/movieTypes"
import { Series } from "../../types/seriesTypes"

// Loops that run as part of the hourly get_data cycle rather than on their own timer
const getDataLoops = ["storage_cleaner", "user_pool_checker"]

// Minutes between get_data runs
const getDataIntervalMins = 60

// Every loop the status page reports on, in display order
const statusLoops = [
  "library_cleanup",
  "content_search",
  "queue_cleaner",
  "failed_cleanup",
  "tidy_directories",
  "permissions_change",
  "backups",
  ...getDataLoops,
]

// Page size bounds for recent arrivals
const defaultArrivalsLimit = 20
const maxArrivalsLimit = 50

type LoopStatus = {
  name: string
  active: boolean
  running: boolean
  interval_mins: number | null
  first_ran: string | null
  last_ran: string | null
  next_run: string | null
  deletions_24h: number
}

type Arrival = {
  type: "movie" | "series"
  title: string
  year: number | null
  poster: string | null
  added: string
  tmdbId: number | null
}

// Convert an optional date-like value to an ISO string, or null
const toISO = (value?: Date | string | null): string | null =>
  value ? new Date(value).toISOString() : null

// Pick whichever of two optional dates is later
const latest = (a: string | null, b: string | null): string | null => {
  if (!a) return b
  if (!b) return a
  return new Date(a) > new Date(b) ? a : b
}

// Find the poster image URL from a Starr app images array
const posterUrl = (images?: { coverType: string; remoteUrl: string }[]): string | null =>
  images?.find((i) => i.coverType === "poster")?.remoteUrl ?? null

// Build the status of one loop from settings, the persisted loop data and this process's run times
const loopStatus = (
  name: string,
  settings: settingsType,
  loops: Partial<Record<string, LoopData | null>>,
  deletions: number,
): LoopStatus => {
  const settingsRecord = settings as unknown as Record<string, unknown>
  const isGetDataLoop = getDataLoops.includes(name)
  const active = Boolean(settingsRecord[name])
  const interval = isGetDataLoop ? getDataIntervalMins : Number(settingsRecord[`${name}_loop`]) || null
  const persisted = loops[name] ?? null
  const inMemory = loopRunTimes.get(isGetDataLoop ? "get_data" : name)

  const lastRan = latest(
    toISO(persisted?.last_ran),
    toISO(inMemory?.finished ?? inMemory?.started),
  )
  const running = !!inMemory && inMemory.finished === null

  return {
    name,
    active,
    running,
    interval_mins: interval,
    first_ran: toISO(persisted?.first_ran),
    last_ran: lastRan,
    next_run:
      active && lastRan && interval && !running
        ? new Date(new Date(lastRan).getTime() + interval * 60000).toISOString()
        : null,
    deletions_24h: deletions,
  }
}

// Turn cached library items into arrivals, keeping only content that has files on disk
const arrivalsFromData = (data: Pick<dataType, "libraries">): Arrival[] => {
  const movies = (data.libraries.find((l) => l.name === "Radarr")?.data ?? []) as Movie[]
  const series = (data.libraries.find((l) => l.name === "Sonarr")?.data ?? []) as Series[]

  const movieArrivals: Arrival[] = movies
    .filter((m) => m.movieFile)
    .map((m) => ({
      type: "movie",
      title: m.title,
      year: m.year ?? null,
      poster: posterUrl(m.images),
      added: toISO(m.movieFile.dateAdded ?? m.added) ?? new Date(0).toISOString(),
      tmdbId: m.tmdbId ?? null,
    }))

  const seriesArrivals: Arrival[] = series
    .filter((s) => (s.statistics?.episodeFileCount ?? 0) > 0)
    .map((s) => ({
      type: "series",
      title: s.title,
      year: s.year ?? null,
      poster: posterUrl(s.images),
      added: toISO(s.added) ?? new Date(0).toISOString(),
      tmdbId: s.tmdbId ?? null,
    }))

  return [...movieArrivals, ...seriesArrivals]
}

const dashboardResolvers = {
  // When each loop last ran, when it runs next, and how much it removed in the last day
  getLoopStatus: async (
    _: unknown,
    req: AuthRequest,
  ): Promise<{ loops: LoopStatus[]; tokens: string[] }> => {
    requireAuth(req)

    const since = new Date(Date.now() - 24 * 60 * 60 * 1000)
    const [settings, data, counts] = await Promise.all([
      Settings.findOne().lean<settingsType>(),
      Data.findOne({}, { loops: 1 }).lean<Pick<dataType, "loops">>(),
      Activity.aggregate<{ _id: string; count: number }>([
        { $match: { at: { $gt: since } } },
        { $group: { _id: "$source", count: { $sum: 1 } } },
      ]),
    ])

    if (!settings) throw new Error("No settings found.")

    const loops = (data?.loops ?? {}) as Partial<Record<string, LoopData | null>>
    const deletionsBySource = new Map(counts.map((c) => [c._id, c.count]))

    return {
      loops: statusLoops.map((name) =>
        loopStatus(name, settings, loops, deletionsBySource.get(name) ?? 0),
      ),
      tokens: req.tokens,
    }
  },

  // The most recently added movies and series that have files on disk, newest first
  getRecentArrivals: async (
    args: { limit?: number },
    req: AuthRequest,
  ): Promise<{ items: Arrival[]; tokens: string[] }> => {
    requireAuth(req)

    const limit = Math.min(Math.max(args.limit ?? defaultArrivalsLimit, 1), maxArrivalsLimit)
    const data = await Data.findOne({}, { libraries: 1 }).lean<Pick<dataType, "libraries">>()

    if (!data) return { items: [], tokens: req.tokens }

    const items = arrivalsFromData(data)
      .sort((a, b) => new Date(b.added).getTime() - new Date(a.added).getTime())
      .slice(0, limit)

    return { items, tokens: req.tokens }
  },
}

export default dashboardResolvers
