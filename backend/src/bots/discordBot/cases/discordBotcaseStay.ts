import { Message } from "discord.js"
import Settings, { settingsDocType } from "../../../models/settings"
import { matchedUser, noDBPull } from "../discordBotUtility"
import { validateStayCommand } from "../validate/validateStayCommand"
import {
  randomNotFoundMessage,
  randomInLibraryNotDownloadedMessage,
  randomAddedToPoolMessage,
} from "../discordBotRandomReply"
import Data, { dataDocType } from "../../../models/data"
import { saveWithRetry } from "../../../shared/database"
import { searchRadarr } from "../../../shared/RadarrStarrRequests"
import { searchSonarr } from "../../../shared/SonarrStarrRequests"
import { sortTMDBSearchArray } from "../../botUtility"
import { Movie } from "../../../types/movieTypes"
import { Series } from "../../../types/seriesTypes"

// Ensure some content isn't deleted by adding it to your user pool
export const caseStay = async (message: Message): Promise<string> => {
  const settings = (await Settings.findOne()) as settingsDocType
  if (!settings) return noDBPull()

  const data = (await Data.findOne()) as dataDocType
  if (!data) return noDBPull()

  // Validate the message
  const parsed = await validateStayCommand(message, settings, data)

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

    // Grab the first movie in the search array
    const foundMovie = sortedMoviesArr[0]

    const movieLibrary = data.libraries.find((API) => API.name === "Radarr")?.data as
      | Movie[]
      | undefined
    if (!movieLibrary) return "There is no movie data in the database... this is bad."

    const movieInDB = movieLibrary.find((m) => m.tmdbId === foundMovie.tmdbId)
    if (!movieInDB) return randomNotFoundMessage()

    // Ensure the movie is downloaded
    if (!movieInDB.movieFile) {
      return randomInLibraryNotDownloadedMessage()
    }

    // Check if this movie is already in the users pool
    const movieMatch = user.pool.movies.find((m) => m.tmdbId === foundMovie.tmdbId)
    if (movieMatch) return `${foundMovie.title} is already in your pool silly goose!`

    // Add the movie to the user pool
    settings.general_bot.users = settings.general_bot.users.map((u) => {
      if (u._id === user._id) {
        return {
          ...u,
          pool: {
            ...u.pool,
            movies: [...u.pool.movies, movieInDB],
          },
        }
      } else {
        return u
      }
    })

    // Save to the database
    await saveWithRetry(settings, "caseStay")

    return randomAddedToPoolMessage("Movie", movieInDB.title)
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

    const seriesLibrary = data.libraries.find((API) => API.name === "Sonarr")?.data as
      | Series[]
      | undefined
    if (!seriesLibrary) return "There is no series data in the database... this is bad."

    const seriesInDB = seriesLibrary.find((s) => s.tmdbId === foundSeries.tmdbId)
    if (!seriesInDB) return randomNotFoundMessage()

    // Check if this series is already in the users pool
    const seriesMatch = user.pool.series.find((m) => m.tmdbId === foundSeries.tmdbId)
    if (seriesMatch) return `${foundSeries.title} is already in your pool silly goose!`

    // Add the movie to the user pool
    settings.general_bot.users = settings.general_bot.users.map((u) => {
      if (u._id === user._id) {
        return {
          ...u,
          pool: {
            ...u.pool,
            series: [...u.pool.series, seriesInDB],
          },
        }
      } else {
        return u
      }
    })

    // Save to the database
    await saveWithRetry(settings, "caseStay")

    return randomAddedToPoolMessage("Series", seriesInDB.title)
  }

  // If we can't find the item in library or queue, just return a not found message.
  return randomNotFoundMessage()
}
