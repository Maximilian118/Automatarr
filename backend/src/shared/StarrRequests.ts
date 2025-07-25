import axios from "axios"
import {
  commandsData,
  dataType,
  downloadQueue,
  importList,
  library,
  qualityProfile,
  rootFolder,
} from "../models/data"
import { APIData } from "./activeAPIsArr"
import {
  capsFirstLetter,
  checkTimePassed,
  cleanUrl,
  dataBoilerplate,
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
import { QualityProfile } from "../types/qualityProfileType"
import { isDocker } from "./fileSystem"
import { axiosErrorMessage } from "./requestError"

// Create a downloadQueue object and retrieve the latest queue data
export const getQueue = async (API: APIData, data: dataType): Promise<downloadQueue | void> => {
  try {
    const res = await axios.get(
      cleanUrl(
        `${API.data.URL}/api/${API.data.API_version}/queue?page=1&pageSize=1000&sortDirection=ascending&sortKey=timeleft&includeUnknownMovieItems=true&includeUnknownSeriesItems=true&apikey=${API.data.KEY}`,
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
    logger.error(`getQueue: ${API.name} Error: ${axiosErrorMessage(err)}`)
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
    logger.error(`getRootFolder: ${API.name} Error: ${axiosErrorMessage(err)}`)
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
      `getLibrary: ${API.name} ${getContentName(API)} search error: ${axiosErrorMessage(err)}`,
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
          `getEpisodes: ${API.name} episode search error for ID ${title}: ${axiosErrorMessage(
            err,
          )}`,
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
      `getEpisodeFiles: ${
        API.name
      } episode file search error for ID ${seriesID}: ${axiosErrorMessage(err)}`,
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
      const library = data.libraries.find((l) => API.name === l.name)

      // Skip if update was done within the last hour
      if (!checkTimePassed(1, "hours", library?.updated_at)) {
        const timer = 60 - moment().diff(moment(library?.updated_at), "minutes")
        logger.info(
          `${API.name} | Skipping Library retrieval. Only once per hour. ${timer} minutes left.`,
        )
        return library
      }

      // Try to fetch new library data
      const updatedLibrary = await getLibrary(API, data)

      // If it failed, log and fall back to existing
      if (!updatedLibrary) {
        logger.error(`${API.name} | Failed to retrieve updated library. Using existing data.`)
        return library
      }

      const baseLibrary = {
        ...updatedLibrary,
        created_at: library ? library.created_at : moment().format(),
      }

      // Add subData for Sonarr (episodes list)
      if (API.name === "Sonarr") {
        return {
          ...baseLibrary,
          episodes: await getAllEpisodes(updatedLibrary.data as Series[], API),
        }
      }

      return baseLibrary
    }),
  )

  // Filter out any completely undefined libraries
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
      `existsInLibrary: ${API.name} ${getContentName(API)} search error: ${axiosErrorMessage(err)}`,
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
    logger.info(
      `getMissingWanted: ${API.name} missing wanted search error: ${axiosErrorMessage(err)}`,
    )
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
  reason?: string,
): Promise<DownloadStatus | undefined> => {
  try {
    const res = await axios.delete(
      cleanUrl(
        `${API.data.URL}/api/${API.data.API_version}/queue/${download.id}?removeFromClient=true&apikey=${API.data.KEY}`,
      ),
    )

    if (requestSuccess(res.status)) {
      logger.success(
        `${API.name} | ${download.title} has been deleted from the queue.${
          reason && ` ${reason}`
        } 🔥`,
      )
      return download
    } else {
      logger.error(
        `${API.name} | ${download.title} could not be deleted from the queue. Err Code: ${res.status}`,
      )
    }
  } catch (err) {
    logger.error(`deleteFromQueue: Could not delete ${download.title}: ${axiosErrorMessage(err)}`)
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
    logger.info(
      `deleteFromLibrary: Could not delete ${libraryItem.title}: ${axiosErrorMessage(err)}`,
    )
  }

  return false
}

// Send the search command for all wanted missing content for passed Starr API
export const searchMissing = async (
  commandList: string[] | undefined,
  APIname: "Radarr" | "Sonarr" | "Lidarr",
  URL: string,
  API_version: string,
  KEY: string,
): Promise<boolean> => {
  // Ensure we have a list of commands for this API
  if (!commandList) {
    logger.error(`wanted_missing | Could not find any commands for ${APIname}.`)
    return false
  }

  // Retrieve the first string that matches startsWith('missing')
  const missingSearchString = commandList.find((str) => str.toLowerCase().startsWith("missing"))

  // Ensure missingSearchString is populated
  if (!missingSearchString) {
    logger.error(`wanted_missing | Could not find a command string for ${APIname}.`)
    return false
  }

  try {
    await axios.post(cleanUrl(`${URL}/api/${API_version}/command?apikey=${KEY}`), {
      name: missingSearchString,
    })

    logger.info(`wanted_missing | ${APIname} search started.`)
    return true
  } catch (err) {
    logger.error(`wanted_missing | ${APIname} error: ${err}.`)
    return false
  }
}

// Get preliminary information for a manual import command
export const getManualImport = async (
  download: DownloadStatus,
  API: APIData,
): Promise<ManualImportResponse | "Download Missing!" | "Unknown Error"> => {
  try {
    const res = await axios.get(
      cleanUrl(
        `${API.data.URL}/api/${API.data.API_version}/manualimport?downloadId=${download.downloadId}&filterExistingFiles=false&apikey=${API.data.KEY}`,
      ),
    )

    if (requestSuccess(res.status)) {
      if (Array.isArray(res.data) && res.data.length === 0) {
        return "Download Missing!"
      }

      return res.data[0]
    } else {
      logger.error(`getManualImport: ${API.name}: Could not retrieve data for ${download.title}.`)
    }
  } catch (err) {
    logger.error(`getManualImport: ${axiosErrorMessage(err)}`)
  }

  return "Unknown Error"
}

// Check for rejections after manualImport
const rejectionsCheck = (manualImport: ManualImportResponse, msgArr: string[]): string => {
  if (!manualImport.rejections || manualImport.rejections.length === 0) {
    return ""
  }

  for (const msg of msgArr) {
    const lowerMsg = msg.toLowerCase()

    const hasMatch = manualImport.rejections.some((rejMsg) => rejMsg.reason.includes(lowerMsg))
    if (hasMatch) return `| ${capsFirstLetter(msg)}.`
  }

  return ""
}

// Import a file from the queue
export const importCommand = async (
  blockedFile: DownloadStatus,
  API: APIData,
): Promise<string | void> => {
  if (!isDocker) {
    logger.info(
      `${API.name} | ${blockedFile.title} | Skipped Import. Running in development mode. 🧊`,
    )

    return
  }

  const manualImport = await getManualImport(blockedFile, API)

  if (typeof manualImport === "string") {
    if (manualImport === "Download Missing!") {
      await deleteFromQueue(blockedFile, API, manualImport)
    }

    return
  }

  if (!manualImport) {
    logger.error(`${API.name} | Failed to retrieve preliminary data from getManualImport request.`)
    return
  }

  // Check to see if the manualImport has any rejections
  const deleteCase = rejectionsCheck(manualImport, ["already imported"])

  if (deleteCase) {
    await deleteFromQueue(blockedFile, API, deleteCase)
    return
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
      return
    }

    logger.success(`${API.name} | ${blockedFile.title} | Imported!`)
    return
  } catch (err) {
    logger.error(`importCommand: ${axiosErrorMessage(err)}`)
    return
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
    logger.info(`getImportLists: ${axiosErrorMessage(err)}`)
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

// Get all quality profiles
export const getQualityProfiles = async (
  API: APIData,
  data: dataType,
): Promise<qualityProfile | undefined> => {
  try {
    const res = await axios.get(
      cleanUrl(`${API.data.URL}/api/${API.data.API_version}/qualityProfile?apikey=${API.data.KEY}`),
    )

    if (requestSuccess(res.status)) {
      logger.success(`${API.name} | Retrieving Quality Profiles.`)

      return {
        ...dataBoilerplate(API, data.importLists),
        data: res.data as QualityProfile[],
      }
    } else {
      logger.error(`getQualityProfiles: Unknown error. Status: ${res.status} - ${res.statusText}`)
    }
  } catch (err) {
    logger.info(`getQualityProfiles: ${axiosErrorMessage(err)}`)
  }

  return
}

// Loop through all of the activeAPIs and return all of the latest quality profiles
export const getAllQualityProfiles = async (
  activeAPIs: APIData[],
  data: dataType,
): Promise<qualityProfile[]> => {
  const results = await Promise.all(
    activeAPIs.map(async (API) => await getQualityProfiles(API, data)),
  )

  // Filter out undefined values
  return results.filter((c): c is qualityProfile => c !== undefined)
}
