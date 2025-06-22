import axios from "axios"
import logger from "../logger"
import { MdblistItem } from "../types/types"
import { APIData } from "./activeAPIsArr"
import { errCodeAndMsg } from "./requestError"
import Settings, { settingsDocType } from "../models/settings"
import { saveWithRetry } from "./database"

// A basic function that returns the passed string and logs it in the backend
const sendListsError = (
  msg: string,
  level: "catastrophic" | "error" | "warn" | "debug" | "info" | "success",
  customLog?: string,
): string => {
  const logMessage = `Remove Missing | ${customLog || msg}`

  if (typeof logger[level] === "function") {
    logger[level](logMessage)
  } else {
    logger.info(logMessage) // fallback in case of unexpected level
  }

  return msg
}

// If Import Lists are from mdbList, extract the list items.
// Will return last known listItems from DB if any request fails or returns nothing.
export const getMdbListItems = async (
  API: APIData,
): Promise<{
  importListItems: MdblistItem[]
  newListItems?: MdblistItem[]
  listsError?: string
}> => {
  const importLists = API.data.importLists
  const listInDB = API.data.listItems

  let mdblistItems: MdblistItem[] = []
  let allRequestsSucceeded = true

  // Check that there are import lists for this API
  if (!importLists || importLists.length === 0) {
    logger.warn(`mdbListItems: ${API.name} has no Import Lists.`)
    return { importListItems: listInDB ?? [] }
  }

  const hasMdbList = importLists.some((il) => il.fields?.some((f) => f.value.includes("mdblist")))
  const hasUnsupp = importLists.some((il) => !il.fields?.some((f) => f.value.includes("mdblist")))

  // If every Import List is not an mdbList, return with error.
  if (!hasMdbList) {
    return {
      importListItems: listInDB ?? [],
      listsError: sendListsError(
        `${API.name} | This loop only supports mdblists. Apologies for the inconvenience!`,
        "error",
      ),
    }
  }

  // If only some Import Lists are not an mdbList, this is really bad and could result in the non mdbList items from being removed.
  // We need to take extra steps to tell the user we can't do this. Stop remove_missing with the error message and deactivate the loop.
  if (hasMdbList && hasUnsupp) {
    const settings = (await Settings.findOne()) as settingsDocType

    if (!settings) {
      logger.error("updateSettings: No settings were found.")
      return {
        importListItems: listInDB ?? [],
        listsError: sendListsError(
          `${API.name} | Import lists contain a mix of mdblists and unsupported list types.`,
          "catastrophic",
        ),
      }
    }

    settings.remove_missing = false
    await saveWithRetry(settings, "getMdbListItems")

    return {
      importListItems: listInDB ?? [],
      listsError: sendListsError(
        `${API.name} | Import lists contain a mix of mdblists and unsupported list types. As a precaution, the Remove Missing loop has been deactivated and must not be re-enabled until this issue is resolved.`,
        "catastrophic",
      ),
    }
  }

  // Loop through all of the import lists
  for (const importList of importLists) {
    // Check that the import list is enabled
    if (!importList.enabled && !importList.enableAutomaticAdd) {
      logger.warn(
        `Remove Missing | ${API.name} | Import List ${importList.name} is disabled and will be ignored.`,
      )
      continue
    }

    if (!importList.fields || importList.fields.length === 0) {
      logger.warn(
        `Remove Missing | ${API.name} | No fields found for ${importList.name} Import List.`,
      )
      continue
    }

    // Loop through all the fields of the import list and extract the mdbList items after the request
    // Each request result adds to mdbListItems giving us an array of every mdbList item from every importList
    for (const field of importList.fields) {
      try {
        const res = await axios.get(`${field.value}/json`)
        mdblistItems.push(...res.data)
      } catch (err) {
        logger.warn(`Remove Missing | ${API.name} | Something went wrong ${errCodeAndMsg(err)}`)
        allRequestsSucceeded = false
        continue
      }
    }
  }

  // Remove any duplicates by id
  const uniqueItems = Array.from(new Map(mdblistItems.map((item) => [item.id, item])).values())

  // If all requests succeeded and we have data, return fresh list + indicator to save it
  if (uniqueItems.length > 0 && allRequestsSucceeded) {
    logger.success(`Remove Missing | ${API.name} | Successfully fetched fresh list items.`)

    return {
      importListItems: uniqueItems,
      newListItems: uniqueItems, // indicates new data was successfully fetched
    }
  }

  // If there are no mdbListItems or partial failures occurred, fallback to DB
  logger.warn(`Remove Missing | ${API.name} | Using fallback listItems from database.`)

  return {
    importListItems: listInDB ?? [],
  }
}
