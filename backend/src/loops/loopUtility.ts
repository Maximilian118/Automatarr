import logger from "../logger"
import { dataType } from "../models/data"
import { APIData } from "../shared/activeAPIsArr"
import { isDocker } from "../shared/fileSystem"
import { deleteFromQueue } from "../shared/StarrRequests"
import { DownloadStatus } from "../types/types"
import { Movie } from "../types/movieTypes"
import { Series } from "../types/seriesTypes"

// Update the loop data
export const updateLoopData = (loopName: keyof dataType["loops"], data: dataType): void => {
  const now = new Date()

  if (!data.loops[loopName]) {
    data.loops[loopName] = {
      first_ran: now,
      last_ran: now,
    }
  } else {
    data.loops[loopName]!.last_ran = now
  }
}

// Check to see if the loop has been ran inside the allocated loop time.
export const shouldSkipLoop = (
  loopName: keyof dataType["loops"],
  data: dataType,
  intervalMinutes: number,
): {
  shouldSkip: boolean
  minutesRemaining?: number
} => {
  const loop = data.loops[loopName]

  if (loop?.last_ran) {
    const minutesSinceLastRun = (Date.now() - new Date(loop.last_ran).getTime()) / 60000

    // Subtract a small buffer (1 minute) from the interval
    const adjustedInterval = Math.max(0, intervalMinutes - 1)

    if (minutesSinceLastRun < adjustedInterval) {
      const minutesRemaining = Math.ceil(adjustedInterval - minutesSinceLastRun)
      logger.warn(`${loopName} | Skipping | Next run allowed in ${minutesRemaining} minutes.`)
      return { shouldSkip: true, minutesRemaining }
    }
  }

  return { shouldSkip: false }
}

// Store stalled torrent attempts in memory, keyed by downloadId (or title as fallback)
const stalledDownloadAttempts = new Map<string, number>()

// Get a unique key for tracking stalled downloads, preferring downloadId over title
// to avoid counter carry-over when a torrent is blocklisted and re-grabbed with the same title
const getStallKey = (blockedFile: DownloadStatus): string => {
  return blockedFile.downloadId?.toLowerCase().trim() ?? blockedFile.title
}

// Function to handle stalled torrents
export const stalledDownloadRemover = async (
  blockedFile: DownloadStatus,
  stalledCase: string,
  API: APIData,
) => {
  const stallKey = getStallKey(blockedFile)
  const stalledTorrent = stalledDownloadAttempts.get(stallKey)

  // If download has not stalled
  if (!stalledCase) {
    // If the download is in stalledDownloadAttempts, remove it
    if (stalledTorrent !== undefined) {
      stalledDownloadAttempts.delete(stallKey)
    }

    return
  }

  const currentAttempts = stalledTorrent || 0
  const nextAttempt = currentAttempts + 1

  stalledDownloadAttempts.set(stallKey, nextAttempt)

  if (nextAttempt < 3) {
    logger.warn(`${API.name} | Stalled | ${blockedFile.title} | Stall count ${nextAttempt}/3`)
  } else {
    logger.warn(`${API.name} | Stalled | ${blockedFile.title} | Stall count exceeded.`)

    if (!isDocker) {
      logger.info(
        `${API.name} | Stalled | ${blockedFile.title} | Skipped deletion. Running in development mode. 🧊`,
      )
      return
    }

    // Delete the queue item
    if (await deleteFromQueue(blockedFile, API, stalledCase)) {
      // Cleanup memory if remove request succeeds
      stalledDownloadAttempts.delete(stallKey)
    } else {
      logger.error(`${API.name} | Stalled | ${blockedFile.title} | Could not be deleted.`)
    }
  }
}

// Robust matching function for user pool items using multiple identifiers
export const matchesPoolItem = (
  poolItem: Movie | Series,
  libraryItem: Movie | Series,
  apiName: string,
): boolean => {
  if (poolItem.id === libraryItem.id) return true
  if (poolItem.tmdbId && poolItem.tmdbId === libraryItem.tmdbId) return true
  if (poolItem.imdbId && poolItem.imdbId === libraryItem.imdbId) return true

  // For series, also match by tvdbId
  if (
    apiName === "Sonarr" &&
    "tvdbId" in poolItem &&
    "tvdbId" in libraryItem &&
    poolItem.tvdbId &&
    poolItem.tvdbId === libraryItem.tvdbId
  ) {
    return true
  }

  // Match by title and year (last resort)
  if (
    poolItem.title.toLowerCase() === libraryItem.title.toLowerCase() &&
    poolItem.year === libraryItem.year
  ) {
    return true
  }

  return false
}
