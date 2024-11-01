import logger from "../logger"
import Data from "../models/data"
import { settingsType } from "../models/settings"
import { Artist } from "../types/artistTypes"
import { Episode } from "../types/episodeTypes"
import { Movie } from "../types/movieTypes"
import { Series } from "../types/seriesTypes"
import { commandData, rootFolderData } from "../types/types"
import { getContentName } from "./utility"

type APIDataFields = {
  URL: string
  KEY: string
  API_version: string
  active: boolean
  commands?: commandData[]
  commandList?: string[]
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
