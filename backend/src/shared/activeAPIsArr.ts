import logger from "../logger"
import Data from "../models/data"
import { settingsType } from "../models/settings"
import { Artist } from "../types/artistTypes"
import { Episode } from "../types/episodeTypes"
import { Movie } from "../types/movieTypes"
import { Series } from "../types/seriesTypes"
import { commandData, DownloadStatus, ImportListData, rootFolderData } from "../types/types"
import { getContentName } from "./utility"

type APIDataFields = {
  URL: string
  KEY: string
  API_version: string
  active: boolean
  commands?: commandData[]
  commandList?: string[]
  downloadQueue?: DownloadStatus[]
  importLists?: ImportListData[]
  rootFolder?: rootFolderData
  library?: (Movie | Series | Artist)[]
  episodes?: Episode[]
  missingWanted?: (Movie | Series | Artist)[]
}

export type APIData = {
  name: "Radarr" | "Sonarr" | "Lidarr"
  data: APIDataFields
}

export const activeAPIsArr = async (settings: settingsType): Promise<APIData[]> => {
  const activeApis: APIData[] = []

  // Helper function to capitalize the first letter
  const capsFirstLetter = (str: string) => str.charAt(0).toUpperCase() + str.slice(1)

  // A list of API's that we don't want to include in the Arr
  const exclusionList = ["qBittorrent"]

  // Iterate over all keys to find active APIs
  Object.keys(settings).forEach((key) => {
    const notExcluded = !exclusionList.some((excluded) => key.includes(excluded))

    if (key.endsWith("_active") && settings[key] === true && notExcluded) {
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
      activeApis.push({
        name: capsFirstLetter(apiName) as "Radarr" | "Sonarr" | "Lidarr",
        data: apiDataFieldsComplete,
      })
    }
  })

  const data = await Data.findOne()

  if (!data) {
    logger.warn("active API's Check: Could not retrieve data for API.")
    return activeApis
  } else {
    return activeApis.map((API) => {
      const subData = data.libraries.find((c) => API.name === c.name)?.subData

      return {
        ...API,
        data: {
          ...API.data,
          commands: data.commands.filter((c) => API.name === c.name).flatMap((c) => c.data),
          commandList: data.commandList.filter((c) => API.name === c.name).flatMap((c) => c.data),
          downloadQueue: data.downloadQueues
            .filter((d) => API.name === d.name)
            .flatMap((d) => d.data),
          importLists: data.importLists.filter((l) => API.name === l.name).flatMap((l) => l.data),
          rootFolder: data.rootFolders.find((f) => API.name === f.name)?.data,
          library: data.libraries
            .filter((c) => API.name === c.name)
            .flatMap((c) => c.data as (Movie | Series | Artist)[]),
          missingWanted: data.missingWanteds
            .filter((c) => API.name === c.name)
            .flatMap((c) => c.data as (Movie | Series | Artist)[]),
          ...(subData ? { [getContentName(API, true, true)]: subData } : {}), // Add subData only if subData exists
        },
      }
    })
  }
}
