import axios from "axios"
import { dataBoilerplate } from "./utility"
import logger from "../logger"
import { commandList, dataType } from "../models/data"
import { APIData } from "./activeAPIsArr"
import { errCodeAndMsg } from "./requestError"

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
    logger.error(
      `scrapeCommandsFromURL: Error while scraping ${APIname} commands: ${errCodeAndMsg(err)}`,
    )
    return []
  }
}

// Loop through all of the activeAPIs and return all of the possible commands for the Starr apps command endpoint
export const getCommandLists = async (
  activeAPIs: APIData[],
  data: dataType,
): Promise<commandList[]> => {
  return await Promise.all(
    activeAPIs.map(async (API) => {
      return {
        ...dataBoilerplate(API, data.commandList),
        data: await scrapeCommandsFromURL(API.name),
      }
    }),
  )
}
