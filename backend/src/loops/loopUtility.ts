import logger from "../logger"
import { dataType } from "../models/data"

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
