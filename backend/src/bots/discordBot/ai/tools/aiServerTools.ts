import moment from "moment"
import Activity, { ActivityAction } from "../../../../models/activity"
import Data, { dataDocType } from "../../../../models/data"
import { formatBytes } from "../../../../shared/utility"
import {
  DownloadPhase,
  downloadState,
  getDownloadSnapshot,
  searchingKeys,
} from "../../../../shared/downloadStatus"
import { DownloadStatus } from "../../../../types/types"
import { ToolHandler, inputString } from "./aiToolTypes"

// Server-wide facts Automatarr already keeps: what it removed and why, and how busy and full the server is

// Most removals listed at once
const MAX_REMOVALS = 8

// Plain English for each kind of removal
const actionLabels: Record<ActivityAction, string> = {
  file: "file deleted",
  folder: "folder deleted",
  library: "removed from the library with its files",
  torrent: "torrent removed",
  queue: "removed from the download queue",
  movie_file: "file deleted so a better copy could be found",
  episode_file: "episode file deleted so a better copy could be found",
}

// Plain English for what removed something
const sourceLabels: Record<string, string> = {
  discord: "a Discord command",
  library_cleanup: "Library Cleanup",
  storage_cleaner: "Storage Cleaner",
  queue_cleaner: "Queue Cleaner",
  failed_cleanup: "Failed Download Cleanup",
  tidy_directories: "Tidy Directories",
  content_search: "Content Search",
  permissions_change: "Permissions Change",
  backups: "Backups",
  manual: "an admin in the web app",
}

// Escape a title for use in a case-insensitive search
const escapeRegex = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")

// What Automatarr removed recently, newest first, optionally only for one title. Answers "why did X disappear?".
const recentRemovals = async (title: string): Promise<string> => {
  const pattern = title ? new RegExp(escapeRegex(title).replace(/\s+/g, ".*"), "i") : null
  const filter = pattern ? { $or: [{ title: pattern }, { path: pattern }] } : {}
  const records = await Activity.find(filter).sort({ at: -1 }).limit(MAX_REMOVALS).lean()

  if (!records.length) {
    return title ? `Nothing matching "${title}" was removed in the last 90 days.` : "Nothing was removed in the last 90 days."
  }

  return records
    .map((r) =>
      [
        moment(r.at).format("D MMM HH:mm"),
        r.title,
        actionLabels[r.action] ?? r.action,
        `by ${sourceLabels[r.source] ?? r.source}`,
        r.reason ? `why: ${r.reason}` : "",
      ]
        .filter(Boolean)
        .join(" | "),
    )
    .join("\n")
}

// Count queue records by download phase, e.g. "4 downloading, 7 queued"
const phaseCounts = (records: DownloadStatus[], describe: (r: DownloadStatus) => DownloadPhase | undefined): string => {
  const counts = new Map<DownloadPhase, number>()
  for (const record of records) {
    const phase = describe(record)
    if (phase) counts.set(phase, (counts.get(phase) ?? 0) + 1)
  }
  return [...counts.entries()].map(([phase, count]) => `${count} ${phase}`).join(", ")
}

// How busy and how full the server is: free space per root folder, what's in the download queues,
// and how many requests are still waiting to be grabbed. Answers "why is it slow?" or "is there room?".
const serverStatus = async (ctx: Parameters<ToolHandler>[0]): Promise<string> => {
  const [data, snapshot, searching] = await Promise.all([
    Data.findOne({}, { rootFolders: 1 }).lean() as Promise<dataDocType | null>,
    getDownloadSnapshot(ctx.settings),
    searchingKeys(),
  ])

  const space = (data?.rootFolders ?? [])
    .filter((rf) => rf.data?.freeSpace)
    .map((rf) => `${rf.name}: ${formatBytes(rf.data.freeSpace)} free${rf.data.totalSpace ? ` of ${formatBytes(rf.data.totalSpace)}` : ""}`)

  const queues = (["movie", "series"] as const).map((type) => {
    const records = snapshot.queues[type]
    const label = type === "movie" ? "Film queue" : "Series queue"
    if (records === null) return `${label}: couldn't be read`
    if (!records.length) return `${label}: empty`
    return `${label}: ${phaseCounts(records, (r) => downloadState([r], snapshot)?.phase)}`
  })

  return [
    space.length ? `Disk space: ${space.join("; ")}` : "Disk space: unknown",
    ...queues,
    snapshot.sabnzbdPaused ? "SABnzbd is paused, so usenet downloads aren't moving." : "",
    `Discord requests waiting to be grabbed: ${searching.size}`,
  ]
    .filter(Boolean)
    .join("\n")
}

// Server facts: recent removals, or the server's current status
const serverInfo: ToolHandler = async (ctx, input) =>
  input.about === "removals" ? recentRemovals(inputString(input, "title")) : serverStatus(ctx)

// Handlers for every server tool, keyed by tool name
export const SERVER_HANDLERS: Record<string, ToolHandler> = {
  server_info: serverInfo,
}
