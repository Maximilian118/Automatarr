import axios from "axios"
import Resolvers from "../graphql/resolvers/resolvers"
import logger from "../logger"
import Data, { dataType, downloadQueue, library, rootFolder } from "../models/data"
import { settingsType } from "../models/settings"
import { commandData, DownloadStatus, graphqlErr, rootFolderData } from "../types/types"
import { Series } from "../types/seriesTypes"
import { Artist } from "../types/artistTypes"
import { Movie } from "../types/movieTypes"
import { Episode } from "../types/episodeTypes"

// Simple calculations
export const minsToSecs = (mins: number): number => mins * 60
export const minsToMillisecs = (mins: number): number => mins * 60000
export const secsToMins = (secs: number): number => secs / 60

// Simple string mutations
export const capsFirstLetter = (str: string): string => str.charAt(0).toUpperCase() + str.slice(1)

// Function to exteact code and message as a string for logger.error
export const errCodeAndMsg = (err: unknown): string => {
  const error = err as graphqlErr
  const res = error.response
  return `${res.status} ${res.data.message}`
}

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
    logger.error(`${loop_name} Error: ${errCodeAndMsg(err)}`)
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
  rootFolder?: rootFolderData
  library?: (Movie | Series | Artist)[]
  missingWanted?: (Movie | Series | Artist)[]
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
          rootFolder: data.rootFolders.find((f) => API.name === f.name)?.data,
          library: data.libraries
            .filter((c) => API.name === c.name)
            .flatMap((c) => c.data as (Movie | Series | Artist)[]),
          missingWanted: data.missingWanteds
            .filter((c) => API.name === c.name)
            .flatMap((c) => c.data as (Movie | Series | Artist)[]),
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
    console.error(
      `scrapeCommandsFromURL: Error while scraping ${APIname} commands: ${errCodeAndMsg(err)}`,
    )
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
    logger.error(`getQueueItem: ${API.name} Error: ${errCodeAndMsg(err)}`)
    return
  }
}

// Retrieve the root folder from the API
export const getRootFolder = async (API: APIData): Promise<rootFolder | undefined> => {
  try {
    const res = await axios.get(
      cleanUrl(`${API.data.URL}/api/${API.data.API_version}/rootfolder?apikey=${API.data.KEY}`),
    )
    return {
      name: API.name,
      data: res.data[0],
    }
  } catch (err) {
    logger.error(`getRootFolder: ${API.name} Error: ${errCodeAndMsg(err)}`)
    return
  }
}

// Retrieve the root folders from all active APIs
export const getAllRootFolders = async (activeAPIs: APIData[]): Promise<rootFolder[]> => {
  const results = await Promise.all(activeAPIs.map(async (API) => await getRootFolder(API)))

  // Filter out undefined values to ensure results is of type rootFolder[]
  return results.filter((folder): folder is rootFolder => folder !== undefined)
}

// Return the name of the library content for one of the Starr apps
export const getContentName = (API: APIData): string => {
  let content = "movie"

  switch (API.name) {
    case "Radarr":
      content = "movie"
      break
    case "Sonarr":
      content = "series" // dataset not checked
      break
    case "Lidarr":
      content = "artist"
      break
    default:
      content = "movie"
      break
  }

  return content
}

// Retrieve the entire library of one of the Starr apps
export const getLibrary = async (API: APIData): Promise<library | undefined> => {
  try {
    const res = await axios.get(
      cleanUrl(
        `${API.data.URL}/api/${API.data.API_version}/${getContentName(API)}?apikey=${API.data.KEY}`,
      ),
    )

    return {
      name: API.name,
      data: res.data,
    }
  } catch (err) {
    logger.info(
      `getLibrary: ${API.name} ${getContentName(API)} search error: ${errCodeAndMsg(err)}`,
    )
    return
  }
}

// As Sonarr is awkward we have to loop through all of the seriesID's and request all of the episodes for each series
export const getEpisodes = async (data: dataType, API: APIData): Promise<Episode[] | undefined> => {
  const seriesIDArr = data.libraries
    .filter((app) => API.name === app.name)
    .flatMap((a) => a.data)
    .map((c) => c.id)

  const episodes: Episode[] = []

  await Promise.all(
    seriesIDArr.map(async (seriesID) => {
      try {
        const res = await axios.get(
          cleanUrl(
            `${API.data.URL}/api/${API.data.API_version}/episode?seriesId=${seriesID}&apikey=${API.data.KEY}`,
          ),
        )

        if (!Array.isArray(res.data)) {
          logger.error(
            `getEpisodes: Could not retrieve episodes for series ${seriesID}. Response is not an array.`,
          )
          return
        }

        // Add the episodes to the episodes array
        episodes.push(...res.data)
      } catch (err) {
        console.log(err)
        logger.error(
          `getEpisodes: ${API.name} episode search error for ID ${seriesID}: ${errCodeAndMsg(err)}`,
        )
      }
    }),
  )

  return episodes
}

// Retrieve library from all active APIs
export const getAllLibraries = async (
  data: dataType,
  activeAPIs: APIData[],
): Promise<library[]> => {
  const results = await Promise.all(
    activeAPIs.map(async (API) => {
      const episodes = API.name === "Sonarr" ? await getEpisodes(data, API) : undefined
      const library = await getLibrary(API)

      return library
        ? {
            ...library,
            ...(episodes ? { subData: episodes } : {}), // Only add subData if episodes exist
          }
        : undefined
    }),
  )

  // Filter out undefined values
  return results.filter((lib): lib is library => lib !== undefined)
}

// Check if a file already exists in the API library
export const existsInLibrary = async (
  ID: number,
  API: APIData,
): Promise<(Movie | Series | Artist)[] | undefined> => {
  try {
    const res = await axios.get(
      // prettier-ignore
      cleanUrl(
        `${API.data.URL}/api/${API.data.API_version}/${getContentName(API)}/${ID}?apikey=${API.data.KEY}`,
      ),
    )

    return res.data
  } catch (err) {
    logger.info(
      `existsInLibrary: ${API.name} ${getContentName(API)} search error: ${errCodeAndMsg(err)}`,
    )
    return
  }
}

// Retrieve all files in missing wanted list
export const getMissingwanted = async (API: APIData): Promise<library | undefined> => {
  try {
    const res = await axios.get(
      // prettier-ignore
      cleanUrl(
        `${API.data.URL}/api/${API.data.API_version}/wanted/missing?page=1&pageSize=1000&apikey=${API.data.KEY}`,
      ),
    )

    return {
      name: API.name,
      data: res.data.records,
    }
  } catch (err) {
    logger.info(`getMissingWanted: ${API.name} missing wanted search error: ${errCodeAndMsg(err)}`)
    return
  }
}

// Retrieve missing wanted files from all active APIs
export const getAllMissingwanted = async (activeAPIs: APIData[]): Promise<library[]> => {
  const results = await Promise.all(activeAPIs.map(async (API) => await getMissingwanted(API)))

  // Filter out undefined values
  return results.filter((lib): lib is library => lib !== undefined)
}
