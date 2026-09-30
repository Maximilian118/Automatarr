import { DownloadPriorityType, PriorityContentType } from "../models/downloadPriority"
import { QueueEntryDescription, SABnzbdMove } from "../types/downloadPriorityTypes"
import { SABnzbdSlot } from "../types/sabnzbdTypes"
import { Torrent } from "../types/qBittorrentTypes"
import { DownloadStatus } from "../types/types"

// The fields of a priority entry the ordering rules care about
type PriorityEntryKey = Pick<
  DownloadPriorityType,
  "content_type" | "starr_id" | "discord_id" | "requested_at"
>

// Films always download before series. A film is a short burst, a series can take hours.
const typeRank = (type: PriorityContentType): number => (type === "movie" ? 0 : 1)

// Sort entries into download order: films before series, then first come first served
export const sortPriorityEntries = <T extends PriorityEntryKey>(entries: T[]): T[] =>
  [...entries].sort(
    (a, b) =>
      typeRank(a.content_type) - typeRank(b.content_type) ||
      new Date(a.requested_at).getTime() - new Date(b.requested_at).getTime(),
  )

// Find which of the other users' downloads a new request has to wait for (ahead)
// and which series it will jump in front of (bumped). The requester's own downloads are ignored.
export const findConflicts = <T extends PriorityEntryKey>(
  request: Omit<PriorityEntryKey, "requested_at">,
  entries: T[],
): { ahead: T[]; bumped: T[] } => {
  const rivals = entries.filter(
    (e) =>
      e.discord_id !== request.discord_id &&
      !(e.content_type === request.content_type && e.starr_id === request.starr_id),
  )
  const rank = typeRank(request.content_type)

  return {
    ahead: sortPriorityEntries(rivals.filter((e) => typeRank(e.content_type) <= rank)),
    bumped: sortPriorityEntries(rivals.filter((e) => typeRank(e.content_type) > rank)),
  }
}

// Describe other users' downloads for a Discord message. Private users are anonymised.
// e.g. "Dave's *Dune*", "Dave's *Dune* and another member's series" or "3 other downloads"
export const describeQueueEntries = (entries: QueueEntryDescription[]): string | null => {
  if (entries.length === 0) return null
  if (entries.length > 2) return `${entries.length} other downloads`

  return entries
    .map((e) =>
      e.private
        ? `another member's ${e.content_type === "movie" ? "film" : "series"}`
        : `${e.name}'s *${e.title}*`,
    )
    .join(" and ")
}

// Get the Starr queue records that belong to a priority entry, in episode order
export const entryDownloads = (
  entry: Pick<DownloadPriorityType, "content_type" | "starr_id">,
  queue: DownloadStatus[],
): DownloadStatus[] =>
  queue
    .filter(
      (q) =>
        q.downloadId &&
        (entry.content_type === "movie" ? q.movieId : q.seriesId) === entry.starr_id,
    )
    .sort(
      (a, b) =>
        (a.seasonNumber ?? 0) - (b.seasonNumber ?? 0) ||
        a.title.localeCompare(b.title, undefined, { numeric: true }),
    )

// Get the unique download IDs for one protocol, keeping the order they were given in
export const uniqueDownloadIds = (
  downloads: DownloadStatus[],
  protocol: "usenet" | "torrent",
): string[] => [
  ...new Set(
    downloads
      .filter((d) => d.protocol === protocol)
      .map((d) => (protocol === "torrent" ? d.downloadId.toLowerCase() : d.downloadId)),
  ),
]

// Work out the fewest SABnzbd calls that put the desired jobs at the front of the queue, in order.
// SABnzbd keeps its queue grouped by priority (Force, High, Normal, Low) and new jobs join the back
// of their group. So the jobs are first promoted to High, which puts them ahead of every Normal job,
// then moved within the High group by switching each one above the job sitting in its target slot.
// Paused jobs are left alone because changing their priority un-pauses them.
// The queue is simulated locally so every call can be planned from a single queue read.
export const planSABnzbdMoves = (queue: SABnzbdSlot[], desired: string[]): SABnzbdMove[] => {
  const slots = queue.map((s) => ({ ...s }))
  const findIndex = (nzoId: string) => slots.findIndex((s) => s.nzo_id === nzoId)
  const moves: SABnzbdMove[] = []

  const tracked = desired.filter((id) => {
    const slot = slots[findIndex(id)]
    return slot && slot.status !== "Paused"
  })

  // Promote each job below High. SABnzbd moves it to the back of the High group.
  tracked.forEach((nzoId) => {
    const index = findIndex(nzoId)
    if (slots[index].priority >= 1) return

    const [slot] = slots.splice(index, 1)
    slot.priority = 1
    const groupEnd = slots.findIndex((s) => s.priority < 1)
    slots.splice(groupEnd === -1 ? slots.length : groupEnd, 0, slot)
    moves.push({ type: "priority", nzoId })
  })

  // Jobs already at Force stay where they are. Order the High ones directly below any Force jobs.
  const ordered = tracked.filter((id) => slots[findIndex(id)].priority === 1)
  const start = slots.findIndex((s) => s.priority <= 1)

  ordered.forEach((nzoId, k) => {
    const target = slots[start + k]
    if (!target || target.nzo_id === nzoId || target.priority !== 1) return

    const from = findIndex(nzoId)
    if (from < start + k) return

    const [slot] = slots.splice(from, 1)
    slots.splice(start + k, 0, slot)
    moves.push({ type: "switch", nzoId, targetNzoId: target.nzo_id })
  })

  return moves
}

// Work out which torrents to send to the top of the qBittorrent queue, in call order.
// A torrent's priority is its queue position (1 = top), or 0/-1 when it isn't queued.
// topPrio is called one hash at a time in reverse so the first desired torrent ends up on top.
export const planqBittorrentMoves = (torrents: Torrent[], desired: string[]): string[] => {
  const positionOf = (hash: string) =>
    torrents.find((t) => t.hash.toLowerCase() === hash)?.priority ?? 0

  const queued = desired.filter((hash) => positionOf(hash) > 0)
  const inOrder = queued.every((hash, k) => positionOf(hash) === k + 1)

  return inOrder ? [] : [...queued].reverse()
}
