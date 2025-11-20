import { Channel, GuildTextBasedChannel, TextBasedChannel } from "discord.js"
import { settingsDocType } from "../../models/settings"
import { searchRadarr } from "../../shared/RadarrStarrRequests"
import { searchSonarr } from "../../shared/SonarrStarrRequests"
import { getDiscordClient } from "./discordBot"
import { discordReply } from "./discordBotUtility"
import { isTextBasedChannel } from "./discordBotTypeGuards"
import { Movie } from "../../types/movieTypes"
import { MonitorOptions, Series } from "../../types/seriesTypes"
import { dataDocType } from "../../models/data"

export const validateTitleAndYear = async (
  rest: string[], // The fill string of a command after the inital !command
  contentType: "movie" | "series" | "album" | "book", // What content type are we searching for?
  settings: settingsDocType,
  data?: dataDocType,
): Promise<
  | string
  | {
      title: string
      year: string
      searchString: string
      foundContentArr: Movie[] | Series[]
      monitor: MonitorOptions
    }
> => {
  // Valid monitor options matching Sonarr's API
  const validMonitorOptions: MonitorOptions[] = [
    "all",
    "future",
    "missing",
    "existing",
    "recent",
    "pilot",
    "firstSeason",
    "lastSeason",
  ]

  let monitor: MonitorOptions = "all" // default
  let year: string
  let title: string

  // Check if the last element is a monitor option
  const lastElement = rest[rest.length - 1]
  const normalizedLast = lastElement.replace(/\s+/g, "").toLowerCase()
  const isLastMonitorOption = validMonitorOptions.some(
    (opt) => opt.toLowerCase() === normalizedLast,
  )

  if (isLastMonitorOption) {
    // Last element is a monitor option, so year should be second-to-last
    if (rest.length < 2) {
      return `The command must contain a title, a 4-digit year, and optionally a monitoring option. For example: !download ${
        contentType === "movie" ? "Top Gun 1986" : "Breaking Bad 2008"
      } ${lastElement}`
    }

    const yearCandidate = rest[rest.length - 2]
    const yearMatch = yearCandidate.match(/^\d{4}$/)

    if (!yearMatch) {
      return `When using a monitoring option, the year must come before it. Format: !download <title> <year> <monitor_option>\nExample: !download Breaking Bad 2008 ${lastElement}`
    }

    year = yearCandidate
    title = rest.slice(0, -2).join(" ")
    monitor = validMonitorOptions.find((opt) => opt.toLowerCase() === normalizedLast)!
  } else {
    // Last element is not a monitor option, check if it's a year
    const yearMatch = lastElement.match(/^\d{4}$/)

    if (!yearMatch) {
      // Not a year and not a valid monitor option
      // Check if the second-to-last element is a year (meaning user passed something after the year)
      if (rest.length >= 2) {
        const secondToLast = rest[rest.length - 2]
        const isSecondToLastYear = secondToLast.match(/^\d{4}$/)

        if (isSecondToLastYear) {
          // User passed "None" which is something we will not allow
          if (lastElement.toLowerCase() === "none") {
            return `The "${lastElement}" monitoring option is not allowed. ⚠️`
          }

          // User passed something after the year that's not a valid monitor option
          return (
            `"${lastElement}" is not a valid monitoring option. ⚠️\n\n` +
            `**Monitoring Options:**\n` +
            `**All** - Monitor all episodes except specials\n` +
            `**Future** - Monitor episodes that have not aired yet\n` +
            `**Missing** - Monitor episodes that do not have files or have not aired yet\n` +
            `**Existing** - Monitor episodes that have files or have not aired yet\n` +
            `**Recent** - Monitor episodes aired within the last 90 days and future episodes\n` +
            `**Pilot** - Only monitor the first episode of the first season\n` +
            `**FirstSeason** - Monitor all episodes of the first season. All other seasons will be ignored\n` +
            `**LastSeason** - Monitor all episodes of the last season`
          )
        }
      }

      // No year found anywhere, show original error with recommendations
      const searchString = rest.join(" ")
      let foundContentArr: Movie[] | Series[] = []

      foundContentArr =
        contentType === "movie"
          ? (await searchRadarr(settings, searchString)) || []
          : (await searchSonarr(settings, searchString)) || []

      if (data) {
        if (contentType === "movie") {
          const movieLibrary = (data.libraries.find((api) => api.name === "Radarr")?.data ??
            []) as Movie[]
          foundContentArr = (foundContentArr as Movie[]).filter((c) =>
            movieLibrary.some((l) => l.tmdbId === c.tmdbId),
          )
        } else {
          const seriesLibrary = (data.libraries.find((api) => api.name === "Sonarr")?.data ??
            []) as Series[]
          foundContentArr = (foundContentArr as Series[]).filter((c) =>
            seriesLibrary.some((l) => l.tvdbId === c.tvdbId),
          )
        }
      }

      const suggestionsHeader = data
        ? "I've found these in your library: 📚"
        : "Is it any of these you wanted? ⛏️"

      const recommendations =
        foundContentArr.length === 0
          ? "I couldn't find any recommendations for that title."
          : `${suggestionsHeader}\n\n` +
            foundContentArr
              .slice(0, 10)
              .map((c) => `${c.title} ${c.year}`)
              .join("\n")

      return `A 4 digit year must be included after the title. ⚠️\n` + recommendations
    }

    // Last element is a year
    year = lastElement
    title = rest.slice(0, -1).join(" ")
  }

  return {
    title,
    year,
    searchString: `${title} ${year}`,
    foundContentArr: [],
    monitor,
  }
}

const isTextChannel = (channel: Channel): channel is GuildTextBasedChannel => {
  // Check if it's a guild text channel or news channel (both have name)
  return channel.isTextBased() && "name" in channel
}

// Check channel the message was sent in is a valid download channel
// Check if the channel the message was sent in is a valid download channel
export const channelValid = (
  channel: Channel,
  settings: settingsDocType,
):
  | string
  | {
      channel: TextBasedChannel
      contentType: "movie" | "series" | "album" | "book"
      contentTypePlural: "movies" | "series" | "albums" | "books"
    } => {
  if (!("name" in channel) || !channel.name) {
    return "Wups! This command can only be used in a named server channel."
  }

  const client = getDiscordClient()

  if (!client) {
    return discordReply("Umm... no client found. This is bad.", "error")
  }

  if (!isTextBasedChannel(channel)) {
    return discordReply("This command must be used in a text-based channel.", "error")
  }

  const dBot = settings.discord_bot

  const channels = [
    { name: dBot.movie_channel_name, contentType: "movies" },
    { name: dBot.series_channel_name, contentType: "series" },
    { name: dBot.music_channel_name, contentType: "albums" },
    { name: dBot.books_channel_name, contentType: "books" },
  ].filter(
    (c): c is { name: string; contentType: "movies" | "series" | "albums" | "books" } => !!c.name,
  )

  if (channels.length === 0) {
    return discordReply(
      "There are no selected channels for content commands. Please contact the server owner.",
      "error",
    )
  }

  const matched = channels.find((c) => c.name === channel.name)

  if (!matched) {
    const suggestions = channels.map((c) => {
      const channelObj = client.channels.cache.find((ch) => isTextChannel(ch) && ch.name === c.name)
      const mention = channelObj ? `<#${channelObj.id}>` : c.name
      return `${mention} for ${c.contentType}`
    })

    const suggestionStr =
      suggestions.length === 1
        ? suggestions[0]
        : suggestions.length === 2
        ? suggestions.join(" or ")
        : `${suggestions.slice(0, -1).join(", ")}, and ${suggestions.at(-1)}`

    return `I'm sorry. You can't use the ${channel.name} channel for this command. Try ${suggestionStr}.`
  }

  const singularMap = {
    movies: "movie",
    series: "series",
    albums: "album",
    books: "book",
  } as const

  return {
    channel: channel as TextBasedChannel,
    contentType: singularMap[matched.contentType],
    contentTypePlural: matched.contentType,
  }
}
