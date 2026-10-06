import DownloadPriority from "../../../models/downloadPriority"
import { BotUserType, settingsDocType } from "../../../models/settings"
import {
  fullyDownloaded,
  getDownloadSnapshot,
  queueStatusText,
  searchingKeys,
} from "../../../shared/downloadStatus"
import { IndexContentType, IndexedTitle, ensureTitleIndex, indexedById } from "./aiTitleIndex"

// What the speaker has downloading, for the AI. Radarr, Sonarr, SABnzbd and qBittorrent are on the
// local network, so reading their queues costs nothing but a moment.

// Something the speaker is waiting on: a Radarr movie ID or Sonarr series ID and a label for it
type DownloadTarget = { type: IndexContentType; id: number; label: string }

// Most downloads listed for the speaker in one message
const MAX_SPEAKER_DOWNLOADS = 5

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
    .filter((e): e is IndexedTitle => !!e && !fullyDownloaded(e.type, e.item))
    .map((e) => ({ type: e.type, id: e.item.id, label: `${e.item.title} (${e.item.year})` }))

  return [...new Map([...requested, ...pooled].map((t) => [`${t.type}:${t.id}`, t])).values()]
}

// Describe what the speaker has downloading or waiting to be grabbed, one line per title.
// Empty when nothing is. Lets the AI answer "how long?" or "is it 1080p?" without a tool call.
export const speakerDownloads = async (
  settings: settingsDocType,
  discordId: string,
  botUser?: BotUserType,
): Promise<string[]> => {
  const targets = await downloadTargets(discordId, botUser)
  if (!targets.length) return []

  const [snapshot, searching] = await Promise.all([
    getDownloadSnapshot(settings, [...new Set(targets.map((t) => t.type))]),
    searchingKeys(),
  ])

  return targets
    .map((t) => ({ t, status: queueStatusText(snapshot, searching, t.type, t.id) }))
    .filter(({ status }) => status)
    .slice(0, MAX_SPEAKER_DOWNLOADS)
    .map(({ t, status }) => `${t.label}: ${status}`)
}
