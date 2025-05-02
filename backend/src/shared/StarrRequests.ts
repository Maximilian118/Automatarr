import axios from "axios"
import {
  commandsData,
  dataType,
  downloadQueue,
  importList,
  library,
  rootFolder,
} from "../models/data"
import { APIData } from "./activeAPIsArr"
import {
  checkTimePassed,
  cleanUrl,
  dataBoilerplate,
  errCodeAndMsg,
  getContentName,
  requestSuccess,
} from "./utility"
import { commandData, DownloadStatus, ImportListData, ManualImportResponse } from "../types/types"
import logger from "../logger"
import { Episode, EpisodeFile } from "../types/episodeTypes"
import { Movie } from "../types/movieTypes"
import { Series } from "../types/seriesTypes"
import { Artist } from "../types/artistTypes"
import moment from "moment"

// Create a downloadQueue object and retrieve the latest queue data
export const getQueue = async (API: APIData, data: dataType): Promise<downloadQueue | void> => {
  try {
    const res = await axios.get(
      cleanUrl(
        `${API.data.URL}/api/${API.data.API_version}/queue?page=1&pageSize=1000&apikey=${API.data.KEY}`,
      ),
    )

    if (requestSuccess(res.status)) {
      logger.success(`${API.name} | Retrieving Queue.`)

      return {
        ...dataBoilerplate(API, data.downloadQueues),
        data: res.data.records as DownloadStatus[],
      }
    } else {
      logger.error(`getQueue: Unknown error. Status: ${res.status} - ${res.statusText}`)
    }
  } catch (err) {
    logger.error(`getQueue: ${API.name} Error: ${errCodeAndMsg(err)}`)
  }

  return
}

// Loop through all of the activeAPIs and return all of the latest downloadQueues
export const getAllDownloadQueues = async (
  activeAPIs: APIData[],
  data: dataType,
): Promise<downloadQueue[]> => {
  const results = await Promise.all(activeAPIs.map(async (API) => await getQueue(API, data)))

  // Filter out undefined values
  return results.filter((c): c is downloadQueue => c !== undefined)
}

// Retrieve the root folder from the API
export const getRootFolder = async (
  API: APIData,
  data: dataType,
): Promise<rootFolder | undefined> => {
  try {
    const res = await axios.get(
      cleanUrl(`${API.data.URL}/api/${API.data.API_version}/rootfolder?apikey=${API.data.KEY}`),
    )

    if (requestSuccess(res.status)) {
      logger.success(`${API.name} | Retrieving Root Folder.`)

      return {
        ...dataBoilerplate(API, data.rootFolders),
        data: res.data[0],
      }
    } else {
      logger.error(`getRootFolder: Unknown error. Status: ${res.status} - ${res.statusText}`)
    }
  } catch (err) {
    logger.error(`getRootFolder: ${API.name} Error: ${errCodeAndMsg(err)}`)
  }

  return
}

// Get all of the current active commands in the system > tasks tab for a specific Starr API
export const getCommands = async (
  API: APIData,
  data: dataType,
): Promise<commandsData | undefined> => {
  try {
    const res = await axios.get(
      cleanUrl(`${API.data.URL}/api/${API.data.API_version}/command?apikey=${API.data.KEY}`),
    )

    if (requestSuccess(res.status)) {
      logger.success(`${API.name} | Retrieving Commands.`)

      return {
        ...dataBoilerplate(API, data.commands),
        data: res.data as commandData[],
      }
    } else {
      logger.error(`getCommands: Unknown error. Status: ${res.status} - ${res.statusText}`)
    }
  } catch (err) {
    logger.error(`getCommands: Could not retrieve commands from ${API.name}: ${err}.`)
  }

  return
}

// Loop through all of the activeAPIs and return all of the latest active commands
export const getAllCommands = async (
  activeAPIs: APIData[],
  data: dataType,
): Promise<commandsData[]> => {
  const results = await Promise.all(activeAPIs.map(async (API) => await getCommands(API, data)))

  // Filter out undefined values
  return results.filter((c): c is commandsData => c !== undefined)
}

// Retrieve the root folders from all active APIs
export const getAllRootFolders = async (
  activeAPIs: APIData[],
  data: dataType,
): Promise<rootFolder[]> => {
  const results = await Promise.all(activeAPIs.map(async (API) => await getRootFolder(API, data)))

  // Filter out undefined values to ensure results is of type rootFolder[]
  return results.filter((folder): folder is rootFolder => folder !== undefined)
}

// Retrieve the entire library of one of the Starr apps
export const getLibrary = async (API: APIData, data: dataType): Promise<library | undefined> => {
  try {
    const res = await axios.get(
      cleanUrl(
        `${API.data.URL}/api/${API.data.API_version}/${getContentName(API)}?apikey=${API.data.KEY}`,
      ),
    )

    if (requestSuccess(res.status)) {
      logger.success(`${API.name} | Retrieving library.`)

      return {
        ...dataBoilerplate(API, data.libraries),
        data: res.data,
      }
    } else {
      logger.error(`getLibrary: Could not retrieve ${API.name} library.. how peculiar..`)
    }
  } catch (err) {
    logger.error(
      `getLibrary: ${API.name} ${getContentName(API)} search error: ${errCodeAndMsg(err)}`,
    )
  }

  return
}

// As Sonarr is awkward we have to loop through all of the seriesID's and request all of the episodes for each series
// Optionally get episode Files as well
export const getAllEpisodes = async (
  library: Series[] | undefined,
  API: APIData,
  episodeFiles: boolean = true,
): Promise<Episode[] | undefined> => {
  if (API.name !== "Sonarr") {
    logger.error(`getEpisodes: This function can only be ran for the Sonarr API.`)
    return
  }

  if (!library || library.length === 0) {
    logger.error(`getEpisodes: No Sonarr library data.`)
    return
  }

  const episodes: Episode[] = []

  await Promise.all(
    library.map(async (series) => {
      const { title, id } = series

      try {
        const res = await axios.get(
          cleanUrl(
            `${API.data.URL}/api/${API.data.API_version}/episode?seriesId=${id}&apikey=${API.data.KEY}`,
          ),
        )

        if (requestSuccess(res.status)) {
          if (!Array.isArray(res.data)) {
            logger.error(
              `getEpisodes: Could not retrieve episodes for series ${title}. Response is not an array.`,
            )

            return
          }

          // Collect all episodes for this series in an array
          let seriesEpisodes = res.data as Episode[]

          // If we want to also get episode files
          if (episodeFiles) {
            // Request episode files from Sonarr API
            const seriesEpisodeFiles = await getEpisodeFiles(API, id)

            // Add episodeFiles to Episodes by id match
            seriesEpisodes = seriesEpisodes.map((se) => {
              const episodeFile = seriesEpisodeFiles.find((sef) => se.episodeFileId === sef.id)

              if (episodeFile) {
                return {
                  ...se,
                  episodeFile,
                }
              } else {
                return se
              }
            })
          }

          // Add the episodes to the episodes array
          episodes.push(...seriesEpisodes)
        } else {
          logger.error(
            `getEpisodes: Could not retrieve episodes for series ID ${title}.. how peculiar..`,
          )
        }
      } catch (err) {
        logger.error(
          `getEpisodes: ${API.name} episode search error for ID ${title}: ${errCodeAndMsg(err)}`,
        )
      }
    }),
  )

  if (episodes.length > 0) {
    logger.success(`${API.name} | Retrieving episodes.`)
  }

  return episodes
}

// Get EpisodeFiles for a series
export const getEpisodeFiles = async (API: APIData, seriesID: number): Promise<EpisodeFile[]> => {
  try {
    const res = await axios.get(
      cleanUrl(
        `${API.data.URL}/api/${API.data.API_version}/episodeFile?seriesId=${seriesID}&apikey=${API.data.KEY}`,
      ),
    )

    if (requestSuccess(res.status)) {
      if (!Array.isArray(res.data)) {
        logger.error(
          `getEpisodeFiles: Could not retrieve episode files for series ${seriesID}. Response is not an array.`,
        )

        return []
      }

      return res.data
    } else {
      logger.error(
        `getEpisodeFiles: Could not retrieve episode files for series ID ${seriesID}.. how peculiar..`,
      )
    }
  } catch (err) {
    logger.error(
      `getEpisodeFiles: ${API.name} episode file search error for ID ${seriesID}: ${errCodeAndMsg(
        err,
      )}`,
    )
  }

  return []
}

// Retrieve library from all active APIs
// Due to how heavy the getLibrary request can be, limit the request to one request per hour for each API.
export const getAllLibraries = async (
  activeAPIs: APIData[],
  data: dataType,
): Promise<library[]> => {
  const results = await Promise.all(
    activeAPIs.map(async (API) => {
      // Find the library for this API in db
      const library = data.libraries.find((l) => API.name === l.name)

      // Check if an hour has passed since the last request
      if (!checkTimePassed(1, "hours", library?.updated_at)) {
        const timer = 60 - moment().diff(moment(library?.updated_at), "minutes")

        logger.info(
          `${API.name} | Skipping Library retrieval. Only once per hour. ${timer} minutes left.`,
        )

        return library
      }

      // Retrieve latest library data
      const updatedLibrary = await getLibrary(API, data)

      return {
        ...updatedLibrary,
        ...(API.name === "Sonarr" && {
          subData: await getAllEpisodes(updatedLibrary?.data as Series[] | undefined, API),
        }),
        created_at: library ? library.created_at : moment().format(),
      }
    }),
  )

  // Filter out undefined values
  return results.filter((l): l is library => l !== undefined)
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
export const getMissingwanted = async (
  API: APIData,
  data: dataType,
): Promise<library | undefined> => {
  try {
    const res = await axios.get(
      // prettier-ignore
      cleanUrl(
        `${API.data.URL}/api/${API.data.API_version}/wanted/missing?page=1&pageSize=1000&apikey=${API.data.KEY}`,
      ),
    )

    if (requestSuccess(res.status)) {
      logger.success(`${API.name} | Retrieving Missing Wanted content.`)

      return {
        ...dataBoilerplate(API, data.missingWanteds),
        data: res.data.records,
      }
    } else {
      logger.error(`getMissingWanted: Unknown error. Status: ${res.status} - ${res.statusText}`)
    }
  } catch (err) {
    logger.info(`getMissingWanted: ${API.name} missing wanted search error: ${errCodeAndMsg(err)}`)
  }

  return
}

// Retrieve missing wanted files from all active APIs
export const getAllMissingwanted = async (
  activeAPIs: APIData[],
  data: dataType,
): Promise<library[]> => {
  const results = await Promise.all(
    activeAPIs.map(async (API) => await getMissingwanted(API, data)),
  )

  // Filter out undefined values
  return results.filter((lib): lib is library => lib !== undefined)
}

// Delete a single item from the queue
export const deleteFromQueue = async (
  download: DownloadStatus,
  API: APIData,
): Promise<number | boolean> => {
  try {
    const res = await axios.delete(
      cleanUrl(
        `${API.data.URL}/api/${API.data.API_version}/queue/${download.id}?removeFromClient=true&apikey=${API.data.KEY}`,
      ),
    )

    return res.status
  } catch (err) {
    logger.info(`deleteFromQueue: Could not delete ${download.title}: ${errCodeAndMsg(err)}`)
    return false
  }
}

// Delete a single item from the library and remove files from file system
export const deleteFromLibrary = async (
  libraryItem: Movie | Series,
  API: APIData,
): Promise<boolean> => {
  try {
    const res = await axios.delete(
      cleanUrl(
        `${API.data.URL}/api/${API.data.API_version}/${getContentName(API)}/${
          libraryItem.id
        }?deleteFiles=true&apikey=${API.data.KEY}`,
      ),
    )

    if (requestSuccess(res.status)) {
      logger.info(`${API.name}: ${libraryItem.title} deleted! 🔥`)
      return true
    } else {
      logger.error(`deleteFromLibrary: Unkown error. Status: ${res.status}`)
    }
  } catch (err) {
    logger.info(`deleteFromLibrary: Could not delete ${libraryItem.title}: ${errCodeAndMsg(err)}`)
  }

  return false
}

// Send the search command for all wanted missing content for passed Starr API
export const searchMissing = async (API: APIData): Promise<boolean> => {
  // Ensure we have a list of commands for this API
  if (!API.data.commandList) {
    logger.error(`wantedMissing: Could not find any commands for ${API.name}.`)
    return false
  }

  // Retrieve the first string that matches startsWith('missing')
  const missingSearchString = API.data.commandList.find((str) =>
    str.toLowerCase().startsWith("missing"),
  )

  // Ensure missingSearchString is populated
  if (!missingSearchString) {
    logger.error(`wantedMissing: Could not find a command string ${API.name}.`)
    return false
  }

  try {
    await axios.post(
      cleanUrl(`${API.data.URL}/api/${API.data.API_version}/command?apikey=${API.data.KEY}`),
      {
        name: missingSearchString,
      },
    )

    logger.info(`wantedMissing: ${API.name} search started.`)
    return true
  } catch (err) {
    logger.error(`wantedMissing: ${API.name} error: ${err}.`)
    return false
  }
}

// Get preliminary information for a manual import command
export const getManualImport = async (
  download: DownloadStatus,
  API: APIData,
): Promise<ManualImportResponse | undefined> => {
  try {
    const res = await axios.get(
      cleanUrl(
        `${API.data.URL}/api/${API.data.API_version}/manualimport?downloadId=${download.downloadId}&filterExistingFiles=false&apikey=${API.data.KEY}`,
      ),
    )

    if (res.data.length === 0 || Number(res.status) !== 200) {
      const deletionStatus = await deleteFromQueue(download, API)
      let deletionMsg = ""

      switch (true) {
        case /^20\d$/.test(deletionStatus.toString()):
          deletionMsg = "Deleted from queue."
          break
        case deletionStatus === 404:
          deletionMsg = "Also, Could not find a file to delete."
          break
        default:
          deletionMsg = "Deletion failed as well."
          break
      }

      logger.error(
        `getManualImport: ${API.name}: Could not retrieve data for ${download.title}. ${deletionMsg}`,
      )
      return
    } else {
      return res.data[0]
    }
  } catch (err) {
    logger.error(`getManualImport: ${errCodeAndMsg(err)}`)
    return
  }
}

// Import a file from the queue
export const importCommand = async (download: DownloadStatus, API: APIData): Promise<boolean> => {
  const manualImport = await getManualImport(download, API)

  if (!manualImport) {
    logger.error(
      `importCommand: ${API.name}: Failed to retrieve preliminary data from getManualImport request.`,
    )
    return false
  }

  try {
    const res = await axios.post(
      cleanUrl(`${API.data.URL}/api/${API.data.API_version}/command?apikey=${API.data.KEY}`),
      {
        name: "ManualImport",
        importMode: "auto",
        files: [
          {
            path: manualImport.path,
            downloadId: manualImport.downloadId,
            folderName: manualImport.folderName,
            indexerFlags: manualImport.indexerFlags,
            languages: manualImport.languages,
            quality: manualImport.quality,
            releaseGroup: manualImport.releaseGroup,
            ...(manualImport.movie && { movieId: manualImport.movie.id }), // Radarr
            ...(manualImport.series && { seriesId: manualImport.series.id }), // Sonarr
            ...(manualImport.episodes && { episodeIds: manualImport.episodes.map((e) => e.id) }), // Sonarr
            ...(manualImport.releaseType && { releaseType: manualImport.releaseType }), // Sonarr
          },
        ],
      },
    )

    if (Number(res.status) !== 201) {
      logger.error(`importCommand: Unexpected Status code: ${res.status}`)
      return false
    }

    return true
  } catch (err) {
    logger.error(`importCommand: ${errCodeAndMsg(err)}`)
    return false
  }
}

// Get all import lists
export const getImportLists = async (
  API: APIData,
  data: dataType,
): Promise<importList | undefined> => {
  try {
    const res = await axios.get(
      cleanUrl(`${API.data.URL}/api/${API.data.API_version}/importlist?apikey=${API.data.KEY}`),
    )

    if (requestSuccess(res.status)) {
      logger.success(`${API.name} | Retrieving Import Lists.`)

      return {
        ...dataBoilerplate(API, data.importLists),
        data: res.data as ImportListData[],
      }
    } else {
      logger.error(`getImportLists: Unknown error. Status: ${res.status} - ${res.statusText}`)
    }
  } catch (err) {
    logger.info(`getImportLists: ${errCodeAndMsg(err)}`)
  }

  return
}

// Loop through all of the activeAPIs and return all of the latest import lists
export const getAllImportLists = async (
  activeAPIs: APIData[],
  data: dataType,
): Promise<importList[]> => {
  const results = await Promise.all(activeAPIs.map(async (API) => await getImportLists(API, data)))

  // Filter out undefined values
  return results.filter((c): c is importList => c !== undefined)
}
