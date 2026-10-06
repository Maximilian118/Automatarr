import { Message } from "discord.js"
import Settings, { settingsDocType } from "../../../models/settings"
import { discordReply, matchedUser, noDBPull } from "../discordBotUtility"
import { validateWaitCommand } from "../validate/validateWaitCommand"
import {
  randomNotFoundMessage,
  randomAlreadyAddedMessage,
  downloadStateMessage,
  notDownloadingMessage,
} from "../discordBotRandomReply"
import Data, { dataDocType } from "../../../models/data"
import { getMovie, searchRadarr } from "../../../shared/RadarrStarrRequests"
import { getSonarrLibrary, searchSonarr } from "../../../shared/SonarrStarrRequests"
import {
  DownloadContentType,
  getDownloadSnapshot,
  libraryItemStatus,
  searchingKeys,
  stateFor,
} from "../../../shared/downloadStatus"
import { sortTMDBSearchArray } from "../../botUtility"
import { Movie } from "../../../types/movieTypes"
import { Series } from "../../../types/seriesTypes"
import { resolveInvalidCommand } from "../ai/aiHandlers"

// Say where a library title is in the download queue, or why nothing is downloading for it
const liveWaitMessage = async (
  settings: settingsDocType,
  type: DownloadContentType,
  item: Movie | Series,
): Promise<string> => {
  const [snapshot, searching] = await Promise.all([getDownloadSnapshot(settings, [type]), searchingKeys()])
  const state = stateFor(snapshot, type, item.id)
  if (state) return downloadStateMessage(state)

  const { text } = libraryItemStatus(type, item, snapshot, searching)
  return text ? notDownloadingMessage(item.title, text) : randomAlreadyAddedMessage()
}

// Check the wait time for a movie or series download
export const caseWaitTime = async (message: Message): Promise<string> => {
  const settings = (await Settings.findOne()) as settingsDocType
  if (!settings) return noDBPull()

  const data = (await Data.findOne()) as dataDocType
  if (!data) return noDBPull()

  // Validate the message
  const parsed = await validateWaitCommand(message, settings, data)

  // Return the error, or let the AI work out what the user meant
  if (typeof parsed === "string") return resolveInvalidCommand(message, parsed)

  // If message is valid, give me the juicy data
  const { channel, searchString, year } = parsed

  // Find the user tied to the author
  const user = matchedUser(settings, message.author.username)
  if (!user) return `A Discord user by ${message.author.username} does not exist in the database.`

  if (!("name" in channel) || !channel.name) {
    return "Wups! This command can only be used in a named server channel."
  }

  // If user is in movie channel
  if (channel.name === settings.discord_bot.movie_channel_name) {
    // See what returns from the radarr API
    const foundMoviesArr = await searchRadarr(settings, searchString)

    // Return if nothing in search results
    if (!foundMoviesArr || foundMoviesArr.length === 0) {
      return randomNotFoundMessage()
    }

    // Sort foundMoviesArr so that if any titles are the same, the passed year is higher in the order
    const sortedMoviesArr = sortTMDBSearchArray<Movie>(foundMoviesArr, year)

    // Grab the first movie in the array
    const foundMovie = sortedMoviesArr[0]

    // Not in the library at all, so there's nothing to wait for
    if (!foundMovie.id) return randomNotFoundMessage()

    // The lookup can carry a stale file record, so ask Radarr whether the file is really there
    const libraryMovie = (await getMovie(settings, foundMovie.id)) ?? foundMovie
    if (libraryMovie.hasFile) return randomAlreadyAddedMessage()

    return liveWaitMessage(settings, "movie", libraryMovie)
  }

  // If user is in series channel
  if (channel.name === settings.discord_bot.series_channel_name) {
    // See what returns from the sonarr API
    const foundSeriesArr = await searchSonarr(settings, searchString)

    // Return if nothing in search results
    if (!foundSeriesArr || foundSeriesArr.length === 0) {
      return randomNotFoundMessage()
    }

    // Sort foundMoviesArr so that if any titles are the same, the passed year is higher in the order
    const sortedSeriesArr = sortTMDBSearchArray<Series>(foundSeriesArr, year)

    // Grab the first series in the array
    const foundSeries = sortedSeriesArr[0]

    // Get latest series data from Sonarr
    const currentLibrary = await getSonarrLibrary(settings)

    if (!currentLibrary) {
      return discordReply(
        "It looks like there's no series data in the database. This is highly unusual.",
        "error",
      )
    }

    // Try matching by unique IDs in order of reliability
    const matchedSeries = currentLibrary.find(
      (l) =>
        l.tvdbId === foundSeries.tvdbId ||
        (foundSeries.tvMazeId && l.tvMazeId === foundSeries.tvMazeId) ||
        (foundSeries.tmdbId && l.tmdbId === foundSeries.tmdbId) ||
        (foundSeries.imdbId && l.imdbId === foundSeries.imdbId),
    )

    // Check if the series is already in the Sonarr library
    if (matchedSeries) {
      if (matchedSeries.statistics.percentOfEpisodes === 100) {
        return randomAlreadyAddedMessage()
      }

      return liveWaitMessage(settings, "series", matchedSeries)
    }
  }

  // If we can't find the item in library or queue, just return a not found message.
  return randomNotFoundMessage()
}
