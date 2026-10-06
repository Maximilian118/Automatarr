import { HistoryItem } from "../types/historyTypes"

// Helpers for picking the right Radarr or Sonarr history entry when blocklisting a bad release

// Sort history entries newest first
const newestFirst = (a: HistoryItem, b: HistoryItem): number => new Date(b.date).getTime() - new Date(a.date).getTime()

// Whether two download IDs are the same. Torrent hashes can differ in case between apps.
const sameDownload = (a?: string, b?: string): boolean => !!a && !!b && a.toLowerCase() === b.toLowerCase()

// Pick the grab to mark as failed: the grab of a specific download when its ID is known, otherwise the
// latest grab. Returns undefined when there's no grab at all, rather than failing an unrelated release.
export const grabToBlocklist = (history: HistoryItem[], downloadId?: string): HistoryItem | undefined => {
  const grabs = history.filter((e) => e.eventType === "grabbed").sort(newestFirst)
  return grabs.find((g) => sameDownload(g.downloadId, downloadId)) ?? grabs[0]
}

// The download ID of the release behind the file currently in the library, from its latest import
export const importedDownloadId = (history: HistoryItem[]): string | undefined =>
  history.filter((e) => e.eventType === "downloadFolderImported").sort(newestFirst)[0]?.downloadId
