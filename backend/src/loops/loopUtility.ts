import logger from "../logger"
import { dataType } from "../models/data"
import { APIData } from "../shared/activeAPIsArr"
import { isDocker } from "../shared/fileSystem"
import { deleteFromQueue } from "../shared/StarrRequests"
import { DownloadStatus } from "../types/types"

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

// Store stalled torrent attempts in memory
const stalledDownloadAttempts = new Map<string, number>()

// Function to handle stalled torrents
export const stalledDownloadRemover = async (
  blockedFile: DownloadStatus,
  stalledCase: string,
  API: APIData,
) => {
  const stalledTorrent = stalledDownloadAttempts.get(blockedFile.title)

  // If download has not stalled
  if (!stalledCase) {
    // If the download is in stalledDownloadAttempts, remove it
    if (!!stalledTorrent) {
      stalledDownloadAttempts.delete(blockedFile.title)
    }

    return
  }

  const currentAttempts = stalledTorrent || 0
  const nextAttempt = currentAttempts + 1

  stalledDownloadAttempts.set(blockedFile.title, nextAttempt)

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
      // cleanup memory if remove request succeeds
      stalledDownloadAttempts.delete(blockedFile.title)
    } else {
      logger.error(`${API.name} | Stalled | ${blockedFile.title} | Could not be deleted.`)
    }
  }
}
