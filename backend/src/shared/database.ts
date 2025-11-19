import moment from "moment"
import logger from "../logger"
import Data, { dataDocType } from "../models/data"
import Settings, { settingsDocType } from "../models/settings"
import User, { UserDocType } from "../models/user"
import WebHook, { WebHookDocType } from "../models/webhook"
import Stats, { StatsDocType } from "../models/stats"
import { isDataDoc, isSettingsDoc, isUserDoc, isWebHookDoc, isStatsDoc } from "../types/typeGuards"
import { removeMongoIds } from "../loops/backups"

export const saveWithRetry = async (
  dbObject: dataDocType | settingsDocType | UserDocType | WebHookDocType | StatsDocType,
  identifier: string,
  maxRetries: number = 3,
  delay: number = 3000,
): Promise<typeof dbObject | undefined> => {
  let attempts = 0

  while (attempts < maxRetries) {
    try {
      if ("updated_at" in dbObject && typeof dbObject.updated_at === "string") {
        dbObject.updated_at = moment().format()
      }

      const res = await dbObject.save()
      logger.success(`${identifier} | Saved.`)
      return res
    } catch (err: any) {
      attempts++

      logger.error(`${identifier} | Save attempt ${attempts} failed: ${err.name} - ${err.message}`)

      if (attempts >= maxRetries) {
        logger.error(`${identifier} | Max database save retries reached. Final failure.`)
        return
      }

      logger.warn(`${identifier} | Retrying database save operation... Attempt ${attempts}`)

      // Retreive the object from the databse again, re-apply changes and try again.
      try {
        let latest: typeof dbObject | null = null

        if (isDataDoc(dbObject)) {
          latest = await Data.findOne()
        } else if (isSettingsDoc(dbObject)) {
          latest = await Settings.findOne()
        } else if (isUserDoc(dbObject)) {
          latest = await User.findOne()
        } else if (isWebHookDoc(dbObject)) {
          latest = await WebHook.findOne()
        } else if (isStatsDoc(dbObject)) {
          latest = await Stats.findOne()
        } else {
          logger.error(`${identifier} | Object doesn't match any type guards.`)
        }

        if (!latest) {
          logger.error(`${identifier} | Failed to re-fetch DB object. Aborting retries.`)
          return
        }

        // Merge changes from old object into the fresh one
        const changes = removeMongoIds(dbObject.toObject?.() || dbObject)
        Object.assign(latest, changes)

        dbObject = latest
      } catch (refetchErr: any) {
        logger.error(`${identifier} | Error refetching object from DB: ${refetchErr.message}`)
        return
      }

      await new Promise((resolve) => setTimeout(resolve, delay))
    }
  }
}
