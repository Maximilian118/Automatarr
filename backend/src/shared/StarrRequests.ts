import axios from "axios"
import { dataType, downloadQueue, library, rootFolder } from "../models/data"
import { APIData } from "./activeAPIsArr"
import { cleanUrl, errCodeAndMsg, getContentName } from "./utility"
import { DownloadStatus } from "../types/types"
import logger from "../logger"
import { Episode } from "../types/episodeTypes"
import { Movie } from "../types/movieTypes"
import { Series } from "../types/seriesTypes"
import { Artist } from "../types/artistTypes"

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

// Delete a single item from the queue
export const deleteFromQueue = async (file: DownloadStatus, API: APIData): Promise<boolean> => {
  try {
    // const res = await axios.get(
    //   cleanUrl(
    //     `${API.data.URL}/api/${API.data.API_version}/queue/${file.id}?removeFromClient=true&apikey=${API.data.KEY}`,
    //   ),
    // )

    return true
  } catch (err) {
    logger.info(
      `deleteFromQueue: Could not delete ${file.title} from ${API.name}: ${errCodeAndMsg(err)}`,
    )
    return false
  }
}
