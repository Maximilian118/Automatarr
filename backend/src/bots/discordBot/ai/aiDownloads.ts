import DownloadPriority from "../../../models/downloadPriority"
import { BotUserType, settingsDocType } from "../../../models/settings"
import { DownloadStatus } from "../../../types/types"
import { Movie } from "../../../types/movieTypes"
import { Series } from "../../../types/seriesTypes"
import { getRadarrQueue } from "../../../shared/RadarrStarrRequests"
import { getSonarrQueue } from "../../../shared/SonarrStarrRequests"
import { formatTimeLeft } from "../../../shared/utility"
import { getQueueItemWithLongestTimeLeft } from "../discordBotUtility"
import { qualityLabel } from "./aiMediaFormat"
import { IndexContentType, IndexedTitle, ensureTitleIndex, indexedById } from "./aiTitleIndex"

// Live download queue facts for the AI. Radarr and Sonarr are on the local network,
// so reading their queues costs nothing but a moment.

export type LiveQueues = Record<IndexContentType, DownloadStatus[]>

// Something the speaker is waiting on: a Radarr movie ID or Sonarr series ID and a label for it
type DownloadTarget = { type: IndexContentType; id: number; label: string }

// Most downloads listed for the speaker in one message
const MAX_SPEAKER_DOWNLOADS = 5

// Fetch the live queues for the content types asked for. Inactive apps give an empty queue.
export const fetchQueues = async (settings: settingsDocType, types: IndexContentType[]): Promise<LiveQueues> => ({
  movie: types.includes("movie") && settings.radarr_active ? await getRadarrQueue(settings, false) : [],
  series: types.includes("series") && settings.sonarr_active ? await getSonarrQueue(settings, false) : [],
})

// The queue items that belong to one Radarr movie or Sonarr series
export const queueItemsFor = (queues: LiveQueues, type: IndexContentType, id: number): DownloadStatus[] =>
  queues[type].filter((q) => (type === "movie" ? q.movieId === id : q.seriesId === id))

// Describe queue items in a few words, e.g. "downloading in 1080p, finishes in 22 minutes".
// Empty when nothing is in the queue.
export const describeQueue = (type: IndexContentType, items: DownloadStatus[]): string => {
  if (!items.length) return ""

  const longest = getQueueItemWithLongestTimeLeft(items)
  const quality = qualityLabel(longest?.quality?.quality?.resolution)
  const what = type === "series" ? `${items.length} episode${items.length === 1 ? "" : "s"} downloading` : "downloading"
  const stalled = items.find((i) => i.status !== "downloading")

  return [
    `${what}${quality ? ` in ${quality}` : ""}`,
    longest?.timeleft ? `${type === "series" ? "last finishes" : "finishes"} in ${formatTimeLeft(longest.timeleft)}` : "",
    stalled ? `status: ${stalled.trackedDownloadState || stalled.status}` : "",
  ]
    .filter(Boolean)
    .join(", ")
}

// Whether a library item still has something left to download
const stillDownloading = (type: IndexContentType, item: Movie | Series): boolean =>
  type === "movie" ? !(item as Movie).hasFile : ((item as Series).statistics?.percentOfEpisodes ?? 0) < 100

// Everything the speaker might be waiting on: downloads they started recently, plus anything
// in their pool that isn't fully downloaded yet
const downloadTargets = async (discordId: string, botUser?: BotUserType): Promise<DownloadTarget[]> => {
  await ensureTitleIndex()

  const requested: DownloadTarget[] = (await DownloadPriority.find({ discord_id: discordId }).lean()).map((p) => ({
    type: p.content_type,
    id: p.starr_id,
    label: p.title,
  }))

  const pooled: DownloadTarget[] = [
    ...(botUser?.pool.movies ?? []).map((m) => indexedById("movie", m.tmdbId)),
    ...(botUser?.pool.series ?? []).map((s) => indexedById("series", s.tvdbId)),
  ]
    .filter((e): e is IndexedTitle => !!e && stillDownloading(e.type, e.item))
    .map((e) => ({ type: e.type, id: e.item.id, label: `${e.item.title} (${e.item.year})` }))

  return [...new Map([...requested, ...pooled].map((t) => [`${t.type}:${t.id}`, t])).values()]
}

// Describe what the speaker has downloading right now, one line per title. Empty when nothing is.
// Lets the AI answer "how long?" or "is it 1080p?" without a title and without a tool call.
export const speakerDownloads = async (
  settings: settingsDocType,
  discordId: string,
  botUser?: BotUserType,
): Promise<string[]> => {
  const targets = await downloadTargets(discordId, botUser)
  if (!targets.length) return []

  const queues = await fetchQueues(settings, [...new Set(targets.map((t) => t.type))])

  return targets
    .map((t) => ({ t, status: describeQueue(t.type, queueItemsFor(queues, t.type, t.id)) }))
    .filter(({ status }) => status)
    .slice(0, MAX_SPEAKER_DOWNLOADS)
    .map(({ t, status }) => `${t.label}: ${status}`)
}
