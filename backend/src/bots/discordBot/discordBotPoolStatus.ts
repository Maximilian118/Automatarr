import { settingsDocType } from "../../models/settings"
import { Movie } from "../../types/movieTypes"
import { Series } from "../../types/seriesTypes"
import { getMovie } from "../../shared/RadarrStarrRequests"
import {
  DownloadContentType,
  fullyDownloaded,
  getDownloadSnapshot,
  libraryItemStatus,
  searchingKeys,
} from "../../shared/downloadStatus"
import { ensureTitleIndex, indexedById } from "./ai/aiTitleIndex"

// The live status of an item in someone's pool, for !list
export type PoolItemStatus = {
  downloaded: boolean // Fully downloaded right now
  text: string // e.g. "Downloading 45%, 20m left", "Queued (#3 in line)" or "Waiting for release". Empty if nothing to say
  active: boolean // Downloading, importing or queued, rather than stuck or waiting
}

// A pool item and its content type
export type PoolEntry = { type: DownloadContentType; item: Movie | Series }

// The key a pool item's status is stored under
export const poolItemKey = (type: DownloadContentType, item: Movie | Series): string =>
  `${type}:${type === "movie" ? item.tmdbId : (item as Series).tvdbId}`

// Find the current library copy of a pool item. Pool entries are snapshots, so the title index is used,
// and films that look undownloaded are double checked with Radarr in case they've just finished.
const currentLibraryItem = async (settings: settingsDocType, { type, item }: PoolEntry): Promise<Movie | Series> => {
  const externalId = type === "movie" ? item.tmdbId : (item as Series).tvdbId
  const indexed = indexedById(type, externalId)?.item ?? item

  if (type === "movie" && indexed.id && !(indexed as Movie).hasFile) {
    return (await getMovie(settings, indexed.id)) ?? indexed
  }

  return indexed
}

// Work out the live status of every pool item, with one look at the download queues for the lot.
// Keyed by poolItemKey.
export const livePoolStatuses = async (
  settings: settingsDocType,
  entries: PoolEntry[],
): Promise<Map<string, PoolItemStatus>> => {
  await ensureTitleIndex()

  const current = await Promise.all(
    entries.map(async (entry) => ({ ...entry, library: await currentLibraryItem(settings, entry) })),
  )

  const unfinishedTypes = [...new Set(current.filter((c) => !fullyDownloaded(c.type, c.library)).map((c) => c.type))]
  const [snapshot, searching] = await Promise.all([
    getDownloadSnapshot(settings, unfinishedTypes),
    searchingKeys(),
  ])

  return new Map(
    current.map((c) => [
      poolItemKey(c.type, c.item),
      { downloaded: fullyDownloaded(c.type, c.library), ...libraryItemStatus(c.type, c.library, snapshot, searching) },
    ]),
  )
}
