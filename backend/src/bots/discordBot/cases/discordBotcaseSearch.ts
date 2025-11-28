import { Message, EmbedBuilder } from "discord.js"
import Settings, { settingsDocType, BotUserType } from "../../../models/settings"
import Data, { dataDocType } from "../../../models/data"
import { noDBPull, getPosterImageUrl } from "../discordBotUtility"
import { validateSearchCommand } from "../validate/validateSearchCommand"
import { searchRadarr } from "../../../shared/RadarrStarrRequests"
import { searchSonarr } from "../../../shared/SonarrStarrRequests"
import { Movie } from "../../../types/movieTypes"
import { Series } from "../../../types/seriesTypes"
import logger from "../../../logger"

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

  // Get library data
  const movieDBList =
    (data.libraries.find((api) => api.name === "Radarr")?.data as Movie[]) || []
  const seriesDBList =
    (data.libraries.find((api) => api.name === "Sonarr")?.data as Series[]) || []

  // Build search string with optional year
  const searchString = year ? `${searchTerm} ${year}` : searchTerm

  // First, try to find a library match using API fuzzy search
  let libraryMatch: Movie | Series | null = null

  try {
    if (isMovieChannel) {
      const apiResults = await searchRadarr(settings, searchString)

      if (apiResults && apiResults.length > 0) {
        // Find first API result that exists in library
        for (const apiMovie of apiResults) {
          const match = movieDBList.find(
            (m) => m.tmdbId === apiMovie.tmdbId || m.imdbId === apiMovie.imdbId,
          )
          if (match) {
            libraryMatch = match
            break
          }
        }
      }
    } else if (isSeriesChannel) {
      const apiResults = await searchSonarr(settings, searchString)

      if (apiResults && apiResults.length > 0) {
        // Find first API result that exists in library
        for (const apiSeries of apiResults) {
          const match = seriesDBList.find(
            (s) => s.tvdbId === apiSeries.tvdbId || s.imdbId === apiSeries.imdbId,
          )
          if (match) {
            libraryMatch = match
            break
          }
        }
      }
    }
  } catch (error) {
    logger.error("Error searching API for library match:", error)
  }

  // If no library match found, show suggestions
  if (!libraryMatch) {
    const suggestions = isMovieChannel
      ? movieDBList.filter((m) => m.title.toLowerCase().includes(searchTerm)).slice(0, 5)
      : seriesDBList.filter((s) => s.title.toLowerCase().includes(searchTerm)).slice(0, 5)

    const suggestionText =
      suggestions.length > 0
        ? `\n\nDid you mean any of these?\n${suggestions.map((s, i) => `${i + 1}. ${s.title} ${s.year}`).join("\n")}`
        : ""

    return `🔍 **No matches found in Library**${suggestionText}`
  }

  // Library match found - search pools for this specific item
  const usersWithMatches: Array<{
    user: BotUserType
    matches: Array<Movie | Series>
  }> = []

  settings.general_bot.users.forEach((user) => {
    const pool = isMovieChannel ? user.pool.movies : user.pool.series
    const matches = pool.filter((item: Movie | Series) => {
      // Match by ID
      if (isMovieChannel) {
        return (item as Movie).tmdbId === (libraryMatch as Movie).tmdbId
      } else {
        return (item as Series).tvdbId === (libraryMatch as Series).tvdbId
      }
    })
    if (matches.length > 0) {
      usersWithMatches.push({ user, matches })
    }
  })

  // If no pool matches for the library item
  if (usersWithMatches.length === 0) {
    return `🔍 **Search Results for "${searchTerm}${year ? ` ${year}` : ""}"**\n\nNobody has "${libraryMatch.title}" in their ${contentType} pool.`
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
          displayMatches
            .map((match) => {
              if (isSeriesChannel) {
                // Add monitor status for series
                const rawStatus = (match as Series).monitorNewItems || "all"
                const monitorDisplay =
                  rawStatus === "all"
                    ? "All Seasons"
                    : rawStatus.charAt(0).toUpperCase() + rawStatus.slice(1)
                return `${match.title} ${match.year}\n**Monitored:** ${monitorDisplay}`
              }
              return `${match.title} ${match.year}`
            })
            .join("\n\n") + (hasMoreMatches ? `\n\n...and ${matches.length - 2} more` : ""),
        )

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
        if (isSeriesChannel) {
          const rawStatus = (match as Series).monitorNewItems || "all"
          const monitorDisplay =
            rawStatus === "all"
              ? "All Seasons"
              : rawStatus.charAt(0).toUpperCase() + rawStatus.slice(1)
          result += `• ${match.title} ${match.year}\n  **Monitored:** ${monitorDisplay}\n`
        } else {
          result += `• ${match.title} ${match.year}\n`
        }
      })

      if (matches.length > 2) {
        result += `• ...and ${matches.length - 2} more\n`
      }
      result += "\n"
    })

    return result
  }
}
