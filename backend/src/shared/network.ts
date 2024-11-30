import { settingsDocType } from "../models/settings"
import logger from "../logger"
import axios from "axios"

// Determine if we're on the same LAN as at least one of the required APIs
export const isOnCorrectLAN = async (
  bootSettings: settingsDocType,
  log?: boolean,
): Promise<boolean> => {
  // Dynamically find all keys in bootSettings that end with 'URL' and are not empty
  const testURLs = Object.entries(bootSettings._doc)
    .filter(
      ([key, value]) =>
        key.endsWith("URL") &&
        key !== "qBittorrent_URL" &&
        value &&
        typeof value === "string" &&
        value.trim() !== "",
    )
    .map(([_, value]) => value) // Include the full URL with protocol and port

  // If no API URL's are populated
  if (testURLs.length === 0) {
    return true
  }

  // Iterate over all URLs
  for (const url of testURLs) {
    try {
      const result = await axios.get(url, { timeout: 1000 }) // Try sending a GET request to the URL

      if (result.status >= 200 && result.status < 300) {
        log && logger.info(`isOnCorrectLAN: Successfully reached ${url}`)
        return true // Return true immediately after first successful API
      } else {
        log && logger.warn(`isOnCorrectLAN: API at ${url} responded with status ${result.status}`)
      }
    } catch (err) {
      log && logger.warn(`isOnCorrectLAN: Error reaching API at ${url}: ${(err as Error).message}`)
    }
  }

  // Return false if all URLs fail
  logger.error("Incorrect LAN?! 눈_눈")
  return false
}
