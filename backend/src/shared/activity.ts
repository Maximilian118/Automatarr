import { AsyncLocalStorage } from "async_hooks"
import logger from "../logger"
import Activity, { ActivityType } from "../models/activity"

// Holds the name of whatever is currently running (a loop, the Discord bot) so removals can be attributed to it
export const activityScope = new AsyncLocalStorage<string>()

// Run a function with every removal inside it attributed to the given source
export const withActivitySource = <T>(source: string, fn: () => Promise<T>): Promise<T> =>
  activityScope.run(source, fn)

export type ActivityEntry = Omit<ActivityType, "_id" | "at" | "source"> & { source?: string }

// Record that something was removed. Fire-and-forget: never throws and never delays the caller.
export const recordActivity = (entry: ActivityEntry): void => {
  try {
    const source = entry.source ?? activityScope.getStore() ?? "manual"

    void Activity.create({ ...entry, source }).catch((err) => {
      logger.error(`recordActivity | Could not record ${entry.action} "${entry.title}": ${err}`)
    })
  } catch (err) {
    logger.error(`recordActivity | Could not record ${entry.action} "${entry.title}": ${err}`)
  }
}
