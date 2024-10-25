import axios from "axios"
import Resolvers from "../graphql/resolvers/resolvers"
import logger from "../logger"
import Data, { downloadQueue } from "../models/data"
import { settingsType } from "../models/settings"
import { commandData, DownloadStatus } from "../types"

// Simple calculations
export const minsToSecs = (mins: number): number => mins * 60
export const minsToMillisecs = (mins: number): number => mins * 60000
export const secsToMins = (secs: number): number => secs / 60

// Simple string mutations
export const capsFirstLetter = (str: string): string => str.charAt(0).toUpperCase() + str.slice(1)

// Dynamically loop based on up-to-date settings
export const dynamicLoop = async (
  loop_name: keyof settingsType,
  content: (settings: settingsType) => Promise<void>,
) => {
  const settings = await Resolvers.getSettings()
  const loopMins = Number(settings[loop_name])

  try {
    // Ensure loopMins is valid
    if (isNaN(loopMins) || loopMins <= 0) {
      logger.error(`${loop_name} Error: Invalid loop minutes: ${loopMins}.`)
      return
    }
    // Execute whatever is in the content function
    await content(settings)
    // Log for next interval
    logger.info(`${loop_name} Executed. Waiting ${loopMins} minutes.`)
    // Schedule the next execution dynamically
    setTimeout(() => dynamicLoop(loop_name, content), minsToMillisecs(loopMins))
  } catch (err) {
    // If error, retry after interval
    logger.error(`${loop_name} Error: ${err}`)
    setTimeout(() => dynamicLoop(loop_name, content), minsToMillisecs(loopMins))
  }
}

// Clean up a URL string removing any unneeded double forward slashes
export const cleanUrl = (url: string): string => url.replace(/([^:]\/)\/+/g, "$1")

type APIDataFields = {
  URL: string
  KEY: string
  API_version: string
  active: boolean
  commands?: commandData[]
  commandList?: string[]
}

type APIData = {
  name: string
  data: APIDataFields
}

export const activeAPIsArr = async (settings: settingsType): Promise<APIData[]> => {
  const activeApis: APIData[] = []

  // Helper function to capitalize the first letter
  const capsFirstLetter = (str: string) => str.charAt(0).toUpperCase() + str.slice(1)

  // Iterate over all keys to find active APIs
  Object.keys(settings).forEach((key) => {
    if (key.endsWith("_active") && settings[key] === true) {
      // Get the API name prefix (like "radarr" from "radarr_active")
      const apiName = key.split("_active")[0]

      // Initialize APIDataFields object to store API-specific settings
      const APIDataFields: Partial<APIDataFields> = {}

      Object.keys(settings).forEach((settingKey) => {
        // If the key starts with the API prefix, include it in the APIData object
        if (settingKey.startsWith(apiName)) {
          // Remove the API prefix and capitalize the remaining key if necessary
          const newKey = settingKey.replace(`${apiName}_`, "") as keyof APIDataFields
          APIDataFields[newKey] = settings[settingKey]
        }
      })

      // Ensure all fields of APIDataFields are filled before casting
      const apiDataFieldsComplete = APIDataFields as APIDataFields

      // Push the constructed API data to the activeApis array
      activeApis.push({ name: capsFirstLetter(apiName), data: apiDataFieldsComplete })
    }
  })

  const data = await Data.findOne()

  if (!data) {
    logger.warn("active API's Check: Could not retrieve data for API.")
    return activeApis
  } else {
    return activeApis.map((API) => {
      return {
        ...API,
        data: {
          ...API.data,
          commands: data.commands.filter((c) => API.name === c.name).flatMap((c) => c.data),
          commandList: data.commandList.filter((c) => API.name === c.name).flatMap((c) => c.data),
        },
      }
    })
  }
}

// Function to scrape commands from a given URL
export const scrapeCommandsFromURL = async (APIname: string): Promise<string[] | []> => {
  const url = `https://raw.githubusercontent.com/${APIname}/${APIname}/develop/frontend/src/Commands/commandNames.js`

  try {
    // Fetch the content from the provided URL
    const { data } = await axios.get(url)

    // Use regex to find the command values
    const commandRegex = /'([\w\s]+)'/g
    const commands: string[] = []

    let match
    // Loop through all matches and populate the array
    while ((match = commandRegex.exec(data)) !== null) {
      const value = match[1]
      commands.push(value)
    }

    // Return the command array
    return commands
  } catch (err) {
    console.error(`scrapeCommandsFromURL: Error while scraping ${APIname} commands: ${err}`)
    return []
  }
}

// Create a downloadQueue object and retrieve the latest queue data
export const getQueueItem = async (API: APIData): Promise<downloadQueue | void> => {
  try {
    const res = await axios.get(
      cleanUrl(
        `${API.data.URL}/api/${API.data.API_version}/queue?page=1&pageSize=1000&apikey=${API.data.KEY}`,
      ),
    )

    return { name: API.name, data: res.data.records as DownloadStatus[] }
  } catch (err) {
    logger.error(`import_blocked_handler: ${API.name} Error: ${err}`)
    return
  }
}
