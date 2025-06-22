import moment from "moment"
import logger from "../logger"
import { dataDocType } from "../models/data"
import { settingsDocType } from "../models/settings"
import { UserDocType } from "../models/user"
import { WebHookDocType } from "../models/webhook"

export const saveWithRetry = async (
  dbObject: dataDocType | settingsDocType | UserDocType | WebHookDocType,
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
      return res
    } catch (err: any) {
      attempts++

      logger.error(
        `${identifier}: Save attempt ${attempts} failed.\n` +
          `Error: ${err.name} - ${err.message}\n` +
          (err.stack ? `Stack Trace:\n${err.stack}` : ""),
      )

      if (attempts >= maxRetries) {
        logger.error(`${identifier}: Max database save retries reached. Final failure.`)
        return
      }

      logger.warn(`${identifier}: Retrying database save operation... Attempt ${attempts}`)
      await new Promise((resolve) => setTimeout(resolve, delay))
    }
  }
}
