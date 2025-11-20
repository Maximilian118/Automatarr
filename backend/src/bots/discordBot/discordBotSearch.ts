import { Message, EmbedBuilder } from "discord.js"
import Settings, { settingsDocType, BotUserType } from "../../models/settings"
import Data, { dataDocType } from "../../models/data"
import { noDBPull, getPosterImageUrl } from "./discordBotUtility"
import { validateSearchCommand } from "./discordBotSearchValidation"
import { searchRadarr } from "../../shared/RadarrStarrRequests"
import { searchSonarr } from "../../shared/SonarrStarrRequests"
import { Movie } from "../../types/movieTypes"
import { Series } from "../../types/seriesTypes"
import logger from "../../logger"

// Search for content across user pools
export const caseSearch = async (message: Message): Promise<string> => {
  const settings = (await Settings.findOne()) as settingsDocType
  if (!settings) return noDBPull()

  const data = (await Data.findOne()) as dataDocType
  if (!data) return noDBPull()

  // Validate the message
  const parsed = await validateSearchCommand(message, settings)
  if (typeof parsed === "string") return parsed

  const { channel, searchTerm, year } = parsed

  if (!("name" in channel) || !channel.name) {
    return "Wups! This command can only be used in a named server channel."
  }

  const isMovieChannel =
    channel.name.toLowerCase() === settings.discord_bot.movie_channel_name.toLowerCase()
  const isSeriesChannel =
    channel.name.toLowerCase() === settings.discord_bot.series_channel_name.toLowerCase()

  // Determine content type based on channel
  const contentType = isMovieChannel ? "movie" : "series"

  // Search through user pools for matches
  const usersWithMatches: Array<{
    user: BotUserType
    matches: Array<any>
  }> = []

  settings.general_bot.users.forEach((user) => {
    const pool = isMovieChannel ? user.pool.movies : user.pool.series
    const matches: Array<any> = []

    pool.forEach((item: any) => {
      const itemTitle = item.title.toLowerCase()
      const itemYear = item.year

      // Check if the search term matches the title
      const titleMatches = itemTitle.includes(searchTerm)

      // If year is specified, require exact year match
      // If no year specified, include all matches
      const yearMatches = year ? itemYear === year : true

      if (titleMatches && yearMatches) {
        matches.push(item) // Store the full item object
      }
    })

    if (matches.length > 0) {
      usersWithMatches.push({ user, matches })
    }
  })

  // If no matches found, use hybrid API + library recommendation system
  if (usersWithMatches.length === 0) {
    let suggestions: (Movie | Series)[] = []

    try {
      if (isMovieChannel) {
        // Get intelligent suggestions from Radarr API
        const apiResults = await searchRadarr(settings, searchTerm)
        const movieDBList =
          (data.libraries.find((api) => api.name === "Radarr")?.data as Movie[]) || []

        // Filter API results to only include items that exist in our library
        if (apiResults) {
          suggestions = apiResults
            .map((apiMovie) => {
              return movieDBList.find(
                (libraryMovie) =>
                  libraryMovie.tmdbId === apiMovie.tmdbId ||
                  libraryMovie.imdbId === apiMovie.imdbId,
              )
            })
            .filter((movie): movie is Movie => movie !== undefined)
            .filter((movie) => {
              // Don't suggest exact matches of what was searched
              const movieTitleYear = `${movie.title.toLowerCase()} ${movie.year}`
              const searchTermWithYear = year ? `${searchTerm} ${year}` : searchTerm
              return (
                movieTitleYear !== searchTermWithYear && movie.title.toLowerCase() !== searchTerm
              )
            })
            .slice(0, 5)
        }
      } else if (isSeriesChannel) {
        // Get intelligent suggestions from Sonarr API
        const apiResults = await searchSonarr(settings, searchTerm)
        const seriesDBList =
          (data.libraries.find((api) => api.name === "Sonarr")?.data as Series[]) || []

        // Filter API results to only include items that exist in our library
        if (apiResults) {
          suggestions = apiResults
            .map((apiSeries) => {
              return seriesDBList.find(
                (librarySeries) =>
                  librarySeries.tvdbId === apiSeries.tvdbId ||
                  librarySeries.imdbId === apiSeries.imdbId,
              )
            })
            .filter((series): series is Series => series !== undefined)
            .filter((series) => {
              // Don't suggest exact matches of what was searched
              const seriesTitleYear = `${series.title.toLowerCase()} ${series.year}`
              const searchTermWithYear = year ? `${searchTerm} ${year}` : searchTerm
              return (
                seriesTitleYear !== searchTermWithYear && series.title.toLowerCase() !== searchTerm
              )
            })
            .slice(0, 5)
        }
      }
    } catch (error) {
      logger.error("Error fetching API suggestions:", error)
      // Fallback to simple library search
      if (isMovieChannel) {
        const movieDBList =
          (data.libraries.find((api) => api.name === "Radarr")?.data as Movie[]) || []
        suggestions = movieDBList
          .filter((m) => m.title.toLowerCase().includes(searchTerm))
          .filter((movie) => {
            // Don't suggest exact matches of what was searched
            const movieTitleYear = `${movie.title.toLowerCase()} ${movie.year}`
            const searchTermWithYear = year ? `${searchTerm} ${year}` : searchTerm
            return movieTitleYear !== searchTermWithYear && movie.title.toLowerCase() !== searchTerm
          })
          .slice(0, 5)
      } else if (isSeriesChannel) {
        const seriesDBList =
          (data.libraries.find((api) => api.name === "Sonarr")?.data as Series[]) || []
        suggestions = seriesDBList
          .filter((s) => s.title.toLowerCase().includes(searchTerm))
          .filter((series) => {
            // Don't suggest exact matches of what was searched
            const seriesTitleYear = `${series.title.toLowerCase()} ${series.year}`
            const searchTermWithYear = year ? `${searchTerm} ${year}` : searchTerm
            return (
              seriesTitleYear !== searchTermWithYear && series.title.toLowerCase() !== searchTerm
            )
          })
          .slice(0, 5)
      }
    }

    const suggestionStrings =
      suggestions.length > 0
        ? suggestions.map((item, i) => `${i + 1}. ${item.title} ${item.year}`).join("\n")
        : ""

    const suggestionText = suggestionStrings
      ? `\n\nDid you mean any of these?\n${suggestionStrings}`
      : ""

    return `🔍 **No matches found**\n\nNobody has "${searchTerm}${
      year ? ` ${year}` : ""
    }" in their ${contentType} pool.${suggestionText}`
  }

  // Create embeds for the results
  if ("send" in message.channel && typeof message.channel.send === "function") {
    const color = isMovieChannel ? 0xff6b6b : 0x4ecdc4 // Red for movies, teal for series
    const embeds: EmbedBuilder[] = []

    usersWithMatches.forEach((userWithMatches) => {
      const { user, matches } = userWithMatches

      // Limit to 2 matches per user to fit in the embed
      const displayMatches = matches.slice(0, 2)
      const hasMoreMatches = matches.length > 2

      const embed = new EmbedBuilder()
        .setColor(color)
        .setTitle(`${user.name}`)
        .setDescription(
          displayMatches.map((match) => `${match.title} ${match.year}`).join("\n") +
            (hasMoreMatches ? `\n...and ${matches.length - 2} more` : ""),
        )
      console.log(matches)
      // Add poster thumbnail from the first match
      const firstMatch = displayMatches[0]
      if (firstMatch) {
        const posterUrl = getPosterImageUrl(firstMatch.images)
        if (posterUrl) {
          embed.setThumbnail(posterUrl)
        }
      }

      embeds.push(embed)
    })

    const headerText = `🔍 **Search Results for "${searchTerm}${year ? ` ${year}` : ""}"**\n\n`

    await message.channel.send({ content: headerText, embeds })
    return ""
  } else {
    // Fallback text format
    let result = `🔍 **Search Results for "${searchTerm}${year ? ` ${year}` : ""}"**\n\n`

    usersWithMatches.forEach((userWithMatches) => {
      const { user, matches } = userWithMatches
      result += `**${user.name}:**\n`

      const displayMatches = matches.slice(0, 2)
      displayMatches.forEach((match) => {
        result += `• ${match.title} ${match.year}\n`
      })

      if (matches.length > 2) {
        result += `• ...and ${matches.length - 2} more\n`
      }
      result += "\n"
    })

    return result
  }
}
