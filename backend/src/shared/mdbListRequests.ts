import axios from "axios"
import logger from "../logger"
import { MdblistItem } from "../types/types"
import { APIData } from "./activeAPIsArr"
import { errCodeAndMsg } from "./requestError"

// If Import Lists are from mdbList, extract the list items.
export const getMdbListItems = async (API: APIData): Promise<MdblistItem[]> => {
  const importLists = API.data.importLists
  let mdblistItems: MdblistItem[] = []

  // Check that there are import lists for this API
  if (!importLists || importLists.length === 0) {
    logger.warn(`mdbListItems: ${API.name} has no Import Lists.`)
    return []
  }

  // Loop through all of the import lists
  for (const importList of importLists) {
    // If this import list does not pertain to mdbList, silently ignore it.
    if (!importList.fields.some((f) => f.value.includes("mdblist"))) {
      continue
    }

    // Check that the import list is enabled
    if (!importList.enabled && !importList.enableAutomaticAdd) {
      logger.warn(
        `mdbListItems: ${API.name}: Import List ${importList.name} is disabled and will be ignored.`,
      )
      continue
    }

    if (!importList.fields || importList.fields.length === 0) {
      logger.warn(`mdbListItems: ${API.name}: No fields found for ${importList.name} Import List.`)
      continue
    }

    // Loop through all the fields of the import list and extract the mdbList items after the request
    // Each request result adds to mdbListItems giving us an array of every mdbList item from every importList
    for (const field of importList.fields) {
      try {
        const res = await axios.get(`${field.value}/json`)
        mdblistItems = [...mdblistItems, ...res.data]
      } catch (err) {
        logger.warn(`mdbListItems: Something went wrong ${errCodeAndMsg(err)}`)
        continue
      }
    }
  }

  // If there are no mdbListItems, something went wrong.
  if (!mdblistItems || mdblistItems.length === 0) {
    logger.warn(`mdbListItems: No Mdblist data.`)
    return []
  }

  // Remove any duplicates by id
  return Array.from(new Map(mdblistItems.map((item) => [item.id, item])).values())
}
