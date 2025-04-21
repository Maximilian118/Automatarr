import logger from "../logger"
import { dataDocType } from "../models/data"

// If saving to the database fails for whatever reason, try again a number of times.
// If every attempt fails, gracefully stop trying.
export const saveWithRetry = async (
  data: dataDocType,
  loopName: string,
  maxRetries: number = 3,
  delay: number = 3000,
): Promise<dataDocType | undefined> => {
  let attempts = 0
  let success = false

  while (attempts < maxRetries && !success) {
    try {
      const res = await data.save()
      success = true // If save succeeds, exit loop
      return res
    } catch (err) {
      attempts++

      if (attempts >= maxRetries) {
        logger.error(`${loopName}: Max database save retries reached, operation failed.`)
        return // Gracefully stop without throwing an error
      }

      logger.warn(`${loopName}: Retrying database save operation... Attempt ${attempts}`)
      await new Promise((resolve) => setTimeout(resolve, delay)) // Wait before retrying
    }
  }
}
