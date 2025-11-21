import { Message } from "discord.js"
import Settings, { settingsDocType } from "../../../models/settings"
import { discordReply, matchedUser, noDBPull } from "../discordBotUtility"
import { validateWaitCommand } from "../validate/validateWaitCommand"
import {
  randomNotFoundMessage,
  randomAlreadyAddedMessage,
  getMovieStatusMessage,
  randomEpisodesDownloadingMessage,
} from "../discordBotRandomReply"
import Data, { dataDocType } from "../../../models/data"
import { getRadarrQueue, searchRadarr } from "../../../shared/RadarrStarrRequests"
import { getSonarrLibrary, getSonarrQueue, searchSonarr } from "../../../shared/SonarrStarrRequests"
import { sortTMDBSearchArray } from "../../botUtility"
import { Movie } from "../../../types/movieTypes"
import { Series } from "../../../types/seriesTypes"

// Check the wait time for a movie or series download
export const caseWaitTime = async (message: Message): Promise<string> => {
  const settings = (await Settings.findOne()) as settingsDocType
  if (!settings) return noDBPull()

  const data = (await Data.findOne()) as dataDocType
  if (!data) return noDBPull()

  // Validate the message
  const parsed = await validateWaitCommand(message, settings, data)

  // Return if an error string is returned from validateDownload
  if (typeof parsed === "string") {
    return parsed
  }

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

    // Check if the movie is already downloaded
    if (foundMovie.movieFile) {
      return randomAlreadyAddedMessage()
    }

    // Check if the movie is in the download queue
    const queue = await getRadarrQueue(settings)
    const movieInQueue = queue.find((movie) => movie.movieId === foundMovie.id)
    if (movieInQueue) return getMovieStatusMessage(movieInQueue.status, movieInQueue.timeleft)
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

      // Check download Queue and see if any episodes for this series are currently being downloaded
      const queue = await getSonarrQueue(settings)
      const episodesInQueue = queue.filter((q) => q.seriesId === foundSeries.id)
      const lastEpisode = episodesInQueue.at(-1)

      if (episodesInQueue.length > 0) {
        return randomEpisodesDownloadingMessage(episodesInQueue.length, lastEpisode?.timeleft)
      }
    }
  }

  // If we can't find the item in library or queue, just return a not found message.
  return randomNotFoundMessage()
}
