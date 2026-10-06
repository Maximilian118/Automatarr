import moment from "moment"
import { settingsType } from "../models/settings"
import DownloadPriority from "../models/downloadPriority"
import { DownloadStatus } from "../types/types"
import { Movie } from "../types/movieTypes"
import { Series } from "../types/seriesTypes"
import { SABnzbdSlot } from "../types/sabnzbdTypes"
import { Torrent } from "../types/qBittorrentTypes"
import { getSABnzbdQueueDetails } from "./sabnzbdRequests"
import { getqBittorrentTorrentsByHash } from "./qBittorrentRequests"
import { getPriorityqBitCookie, getStarrQueueRecords } from "./downloadPriorityClients"
import { formatTimeLeft } from "./utility"

// Live "where is my download" answers for Discord and the AI, built from one look at the
// Radarr/Sonarr queues plus SABnzbd and qBittorrent for the detail Starr apps don't pass on:
// real queue positions, percentages and time left.

export type DownloadContentType = "movie" | "series"

// Everything in the download queues right now. A null queue means its Starr app couldn't be reached.
export type DownloadSnapshot = {
  queues: Record<DownloadContentType, DownloadStatus[] | null>
  sabnzbd: Map<string, SABnzbdSlot> // Keyed by nzo_id, which Starr apps store as downloadId
  sabnzbdPaused: boolean // The whole SABnzbd queue is paused
  torrents: Map<string, Torrent> // Keyed by lower-cased hash, which Starr apps store as downloadId
}

// The stage a download is at, most active first
export type DownloadPhase = "downloading" | "importing" | "queued" | "paused" | "stalled" | "delayed" | "failed"

// Where a film or series is in the download queue
export type DownloadState = {
  phase: DownloadPhase // The most active stage across its downloads
  count: number // How many downloads it has in the queue, e.g. episodes
  phases: Partial<Record<DownloadPhase, number>> // How many downloads are at each stage
  percent?: number // How far through, for a single download
  secondsLeft?: number // Until its last download finishes
  position?: number // Its place in the download client's queue, starting at 1
}

// The state of a single queue record
type RecordState = { phase: DownloadPhase; percent?: number; secondsLeft?: number; position?: number }

// Order phases are reported in when a series has downloads at several stages
const PHASE_ORDER: DownloadPhase[] = ["downloading", "importing", "queued", "paused", "stalled", "delayed", "failed"]

// qBittorrent reports an unknown ETA as 100 days
const QBIT_UNKNOWN_ETA = 8640000

// qBittorrent torrent states, grouped by what they mean for the user
const QBIT_DOWNLOADING = ["downloading", "forcedDL", "metaDL", "forcedMetaDL", "checkingDL", "allocating"]
const QBIT_QUEUED = ["queuedDL", "checkingResumeData", "moving"]
const QBIT_PAUSED = ["pausedDL", "stoppedDL"]
const QBIT_STALLED = ["stalledDL", "missingFiles", "error"]

// SABnzbd job statuses that mean it's still waiting for its turn
const SAB_QUEUED = ["Queued", "Grabbing", "Propagating", "Fetching"]

// Convert a clock style time to seconds, e.g. "1:02:03" or SABnzbd's "1:02:03:04" (days first)
const clockSeconds = (clock: string): number | undefined => {
  const parts = clock.split(":").map(Number)
  if (!parts.length || parts.some((p) => !Number.isFinite(p))) return undefined
  return parts.reverse().reduce((total, part, i) => total + part * [1, 60, 3600, 86400][i], 0)
}

// Convert a Starr app time left, e.g. "02:03:04" or "1.02:03:04", to seconds
const starrSeconds = (timeleft?: string): number | undefined => {
  if (!timeleft) return undefined
  const seconds = moment.duration(timeleft).asSeconds()
  return seconds > 0 ? seconds : undefined
}

// Work out the state of one queue record, preferring what the download client itself says
const recordState = (record: DownloadStatus, snapshot: DownloadSnapshot): RecordState => {
  const tracked = record.trackedDownloadState ?? ""
  if (tracked === "importPending" || tracked === "importing") return { phase: "importing" }
  if (tracked === "failedPending" || record.status === "failed") return { phase: "failed" }
  if (record.status === "delay") return { phase: "delayed", secondsLeft: starrSeconds(record.timeleft) }

  const starrPercent = record.size ? Math.round(((record.size - record.sizeleft) / record.size) * 100) : undefined

  const slot = record.protocol === "usenet" ? snapshot.sabnzbd.get(record.downloadId) : undefined
  if (slot) {
    if (slot.status === "Paused" || snapshot.sabnzbdPaused) return { phase: "paused", percent: slot.percentage }
    if (SAB_QUEUED.includes(slot.status)) {
      return { phase: "queued", position: slot.index + 1, secondsLeft: clockSeconds(slot.timeleft) }
    }
    return { phase: "downloading", percent: slot.percentage, secondsLeft: clockSeconds(slot.timeleft) }
  }

  const torrent = record.protocol === "torrent" ? snapshot.torrents.get(record.downloadId?.toLowerCase()) : undefined
  if (torrent) {
    const percent = Math.round(torrent.progress * 100)
    const secondsLeft = torrent.eta > 0 && torrent.eta < QBIT_UNKNOWN_ETA ? torrent.eta : undefined
    if (QBIT_PAUSED.includes(torrent.state)) return { phase: "paused", percent }
    if (QBIT_STALLED.includes(torrent.state)) return { phase: "stalled", percent }
    if (QBIT_QUEUED.includes(torrent.state)) {
      return { phase: "queued", percent, position: torrent.priority > 0 ? torrent.priority : undefined }
    }
    if (QBIT_DOWNLOADING.includes(torrent.state)) return { phase: "downloading", percent, secondsLeft }
  }

  // Only the Starr app's view is available
  if (record.status === "queued") return { phase: "queued", secondsLeft: starrSeconds(record.timeleft) }
  if (record.status === "paused") return { phase: "paused", percent: starrPercent }
  if (record.status === "warning") return { phase: "stalled", percent: starrPercent }
  return { phase: "downloading", percent: starrPercent, secondsLeft: starrSeconds(record.timeleft) }
}

// Combine the states of every download a title has into one, e.g. all the episodes of a series
export const downloadState = (records: DownloadStatus[], snapshot: DownloadSnapshot): DownloadState | null => {
  if (!records.length) return null

  const states = records.map((r) => recordState(r, snapshot))
  const phases: Partial<Record<DownloadPhase, number>> = {}
  for (const s of states) phases[s.phase] = (phases[s.phase] ?? 0) + 1

  const phase = PHASE_ORDER.find((p) => phases[p]) ?? "downloading"
  const times = states.map((s) => s.secondsLeft).filter((t): t is number => t !== undefined)
  const positions = states.map((s) => s.position).filter((p): p is number => p !== undefined)

  return {
    phase,
    count: records.length,
    phases,
    percent: records.length === 1 ? states[0].percent : undefined,
    secondsLeft: times.length ? Math.max(...times) : undefined,
    position: positions.length ? Math.min(...positions) : undefined,
  }
}

// A short time left, e.g. "45m", "2h 5m" or "3d 4h"
export const shortTimeLeft = (seconds: number): string => {
  const d = Math.floor(seconds / 86400)
  const h = Math.floor((seconds % 86400) / 3600)
  const m = Math.round((seconds % 3600) / 60)

  if (d) return `${d}d${h ? ` ${h}h` : ""}`
  if (h) return `${h}h${m ? ` ${m}m` : ""}`
  return m ? `${m}m` : "under a minute"
}

// A full time left, e.g. "2 hours, 5 minutes"
export const longTimeLeft = (seconds: number): string => formatTimeLeft(moment.duration(seconds, "seconds"))

// Describe one phase of a single download
const phaseText = (state: DownloadState, phase: DownloadPhase): string => {
  const percent = state.percent !== undefined ? ` ${state.percent}%` : ""
  const left = state.secondsLeft !== undefined ? `, ${shortTimeLeft(state.secondsLeft)} left` : ""

  switch (phase) {
    case "downloading":
      return `Downloading${percent}${left}`
    case "importing":
      return "Downloaded, importing now"
    case "queued":
      return `Queued${state.position ? ` (#${state.position} in line)` : ""}${left}`
    case "paused":
      return `Paused${percent}`
    case "stalled":
      return `Stalled${percent}, waiting for sources`
    case "delayed":
      return "Waiting a little for a better release"
    case "failed":
      return "Failed, looking for another copy"
  }
}

// Describe a download state in a few words, e.g. "Downloading 45%, 20m left", "Queued (#3 in line)"
// or, for several episodes, "5 episodes: 2 downloading, 3 queued, last done in 2h 5m"
export const describeDownloadState = (state: DownloadState): string => {
  if (state.count === 1) return phaseText(state, state.phase)

  const breakdown = PHASE_ORDER.filter((p) => state.phases[p]).map((p) => `${state.phases[p]} ${p}`)
  const left = state.secondsLeft !== undefined ? `, last done in ${shortTimeLeft(state.secondsLeft)}` : ""
  return `${state.count} episodes: ${breakdown.join(", ")}${left}`
}

// Whether a download state means things are moving, rather than stuck or waiting
export const downloadActive = (state: DownloadState): boolean =>
  state.phase === "downloading" || state.phase === "importing" || state.phase === "queued"

// Look at the download queues for the content types asked for. One call per Starr app, plus one to
// SABnzbd and one to qBittorrent when they hold any of the queued downloads.
export const getDownloadSnapshot = async (
  settings: settingsType,
  types: DownloadContentType[] = ["movie", "series"],
): Promise<DownloadSnapshot> => {
  const [movie, series] = await Promise.all([
    types.includes("movie") ? getStarrQueueRecords(settings, "Radarr") : Promise.resolve([]),
    types.includes("series") ? getStarrQueueRecords(settings, "Sonarr") : Promise.resolve([]),
  ])

  const records = [...(movie ?? []), ...(series ?? [])]
  const usenet = records.some((r) => r.protocol === "usenet")
  const hashes = [...new Set(records.filter((r) => r.protocol === "torrent" && r.downloadId).map((r) => r.downloadId.toLowerCase()))]

  const [sabnzbd, torrents] = await Promise.all([
    usenet && settings.sabnzbd_active ? getSABnzbdQueueDetails(settings) : Promise.resolve(null),
    hashes.length && settings.qBittorrent_active ? torrentsByHash(settings, hashes) : Promise.resolve([]),
  ])

  return {
    queues: { movie, series },
    sabnzbd: new Map((sabnzbd?.slots ?? []).map((s) => [s.nzo_id, s])),
    sabnzbdPaused: !!sabnzbd?.paused,
    torrents: new Map(torrents.map((t) => [t.hash.toLowerCase(), t])),
  }
}

// Get specific torrents from qBittorrent. Empty when it can't be reached.
const torrentsByHash = async (settings: settingsType, hashes: string[]): Promise<Torrent[]> => {
  const cookie = await getPriorityqBitCookie(settings, false)
  return cookie ? ((await getqBittorrentTorrentsByHash(settings, cookie, hashes)) ?? []) : []
}

// The queue records that belong to one Radarr movie or Sonarr series
export const recordsFor = (snapshot: DownloadSnapshot, type: DownloadContentType, id: number): DownloadStatus[] =>
  (snapshot.queues[type] ?? []).filter((q) => (type === "movie" ? q.movieId === id : q.seriesId === id))

// The download state of one Radarr movie or Sonarr series. Null when nothing of it is in the queue.
export const stateFor = (snapshot: DownloadSnapshot, type: DownloadContentType, id: number): DownloadState | null =>
  downloadState(recordsFor(snapshot, type, id), snapshot)

// Which Starr app's queue couldn't be read, so callers don't mistake a failure for "not downloading"
export const queueUnavailable = (snapshot: DownloadSnapshot, type: DownloadContentType): boolean =>
  snapshot.queues[type] === null

// Movies and series that were requested on Discord but haven't been grabbed yet, as "type:starrId" keys
export const searchingKeys = async (): Promise<Set<string>> => {
  const pending = await DownloadPriority.find({ activated_at: null }, { content_type: 1, starr_id: 1 }).lean()
  return new Set(pending.map((p) => `${p.content_type}:${p.starr_id}`))
}

// Which release Radarr waits for before grabbing, by its minimum availability setting
const availabilityLabels: Record<string, string> = {
  announced: "first",
  inCinemas: "cinema",
  released: "digital or physical",
}

// Why a film that's in the library but not downloaded isn't grabbable yet, or "" if it is
export const releaseWait = (movie: Movie): string => {
  if (!movie.id || movie.hasFile || movie.isAvailable === undefined) return ""

  return movie.isAvailable
    ? "release is out, waiting for a good copy to download"
    : `can't be grabbed until its ${availabilityLabels[movie.minimumAvailability] ?? "official"} release`
}

// Why a library title that isn't fully downloaded has nothing in the queue, e.g. "Waiting for release"
export const notDownloadingReason = (
  type: DownloadContentType,
  item: Movie | Series,
  searching: Set<string>,
): string => {
  if (searching.has(`${type}:${item.id}`)) return "Searching for a copy"

  if (type === "series") return "Waiting for missing episodes"

  const movie = item as Movie
  if (movie.isAvailable === false) {
    const digital = movie.digitalRelease && moment(movie.digitalRelease).isAfter(moment())
    return digital ? `Waiting for release (digital ${moment(movie.digitalRelease).format("D MMM")})` : "Waiting for release"
  }

  return "Released, waiting for a good copy"
}

// Whether a library title is fully downloaded
export const fullyDownloaded = (type: DownloadContentType, item: Movie | Series): boolean =>
  type === "movie" ? !!(item as Movie).hasFile : ((item as Series).statistics?.percentOfEpisodes ?? 0) >= 100

// What's happening to a library title in the download queue right now: its download state,
// "Searching for a copy" if it was requested but not grabbed yet, or "" if neither
export const queueStatusText = (
  snapshot: DownloadSnapshot,
  searching: Set<string>,
  type: DownloadContentType,
  id: number,
): string => {
  const state = stateFor(snapshot, type, id)
  if (state) return describeDownloadState(state)
  return searching.has(`${type}:${id}`) ? "Searching for a copy" : ""
}

// The live status of a library title: its download state if it's in the queue, otherwise why not.
// Empty when it's fully downloaded and nothing more is coming.
export const libraryItemStatus = (
  type: DownloadContentType,
  item: Movie | Series,
  snapshot: DownloadSnapshot,
  searching: Set<string>,
): { text: string; active: boolean } => {
  const state = item.id ? stateFor(snapshot, type, item.id) : null
  if (state) return { text: describeDownloadState(state), active: downloadActive(state) }
  if (fullyDownloaded(type, item) || !item.id) return { text: "", active: false }
  if (queueUnavailable(snapshot, type)) return { text: "Download status unavailable", active: false }

  return { text: notDownloadingReason(type, item, searching), active: searching.has(`${type}:${item.id}`) }
}
