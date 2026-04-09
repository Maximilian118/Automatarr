import { Channel, GuildTextBasedChannel, TextBasedChannel } from "discord.js"
import { settingsDocType } from "../../../models/settings"
import { searchRadarr } from "../../../shared/RadarrStarrRequests"
import { searchSonarr } from "../../../shared/SonarrStarrRequests"
import { getDiscordClient } from "../discordBot"
import { discordReply } from "../discordBotUtility"
import { allQualityAliases } from "../discordBotUtility"
import { isTextBasedChannel } from "../discordBotTypeGuards"
import { Movie } from "../../../types/movieTypes"
import { MonitorOptions, Series } from "../../../types/seriesTypes"
import { dataDocType } from "../../../models/data"

// Check if a string is a recognized quality alias (e.g., "4k", "1080p", "uhd")
const isQualityArg = (str: string): boolean =>
  allQualityAliases.includes(str.toLowerCase().trim())

export const validateTitleAndYear = async (
  rest: string[], // The full string of a command after the initial !command
  contentType: "movie" | "series" | "album" | "book", // What content type are we searching for?
  settings: settingsDocType,
  data?: dataDocType,
  allowSpecialOptions?: boolean,
): Promise<
  | string
  | {
      title: string
      year: string
      searchString: string
      foundContentArr: Movie[] | Series[]
      monitor: MonitorOptions
      quality?: string
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

  if (allowSpecialOptions) {
    validMonitorOptions.push("monitorSpecials", "unmonitorSpecials")
  }

  // Check if a string is a valid monitor option
  const isMonitorOption = (str: string): boolean =>
    validMonitorOptions.some((opt) => opt.toLowerCase() === str.replace(/\s+/g, "").toLowerCase())

  let monitor: MonitorOptions = "all" // default
  let quality: string | undefined
  let year: string
  let title: string

  // Collect trailing arguments after the title and year.
  // Format: !download <title> <year> [quality] [monitor]
  // Quality and monitor can appear in any order after the year.
  const lastElement = rest[rest.length - 1]
  const secondToLast = rest.length >= 2 ? rest[rest.length - 2] : undefined
  const thirdToLast = rest.length >= 3 ? rest[rest.length - 3] : undefined

  // Determine how many trailing optional args exist after the year
  const lastIsMonitor = isMonitorOption(lastElement)
  const lastIsQuality = isQualityArg(lastElement)
  const secondIsMonitor = secondToLast ? isMonitorOption(secondToLast) : false
  const secondIsQuality = secondToLast ? isQualityArg(secondToLast) : false

  // Case 1: Two trailing args (quality + monitor in any order)
  if (
    thirdToLast?.match(/^\d{4}$/) &&
    ((lastIsMonitor && secondIsQuality) || (lastIsQuality && secondIsMonitor))
  ) {
    year = thirdToLast
    title = rest.slice(0, -3).join(" ")

    if (lastIsMonitor) {
      monitor = validMonitorOptions.find(
        (opt) => opt.toLowerCase() === lastElement.replace(/\s+/g, "").toLowerCase(),
      )!
      quality = secondToLast!
    } else {
      monitor = validMonitorOptions.find(
        (opt) => opt.toLowerCase() === secondToLast!.replace(/\s+/g, "").toLowerCase(),
      )!
      quality = lastElement
    }
  }
  // Case 2: One trailing arg that is a monitor option
  else if (lastIsMonitor && secondToLast?.match(/^\d{4}$/)) {
    year = secondToLast!
    title = rest.slice(0, -2).join(" ")
    monitor = validMonitorOptions.find(
      (opt) => opt.toLowerCase() === lastElement.replace(/\s+/g, "").toLowerCase(),
    )!
  }
  // Case 3: One trailing arg that is a quality alias
  else if (lastIsQuality && secondToLast?.match(/^\d{4}$/)) {
    year = secondToLast!
    title = rest.slice(0, -2).join(" ")
    quality = lastElement
  }
  // Case 4: Last element is a year (no trailing args)
  else if (lastElement.match(/^\d{4}$/)) {
    year = lastElement
    title = rest.slice(0, -1).join(" ")
  }
  // Case 5: No valid year found — show error with recommendations
  else {
    // Check if the second-to-last element is a year (user passed something unrecognized after the year)
    if (rest.length >= 2 && secondToLast?.match(/^\d{4}$/)) {
      const isSpecialOption =
        lastElement.toLowerCase() === "monitorspecials" ||
        lastElement.toLowerCase() === "unmonitorspecials"

      if (lastElement.toLowerCase() === "none") {
        return `The "${lastElement}" monitoring option is not allowed ever. ⚠️`
      }

      if (!allowSpecialOptions && isSpecialOption) {
        return `The "${lastElement}" monitoring option is not allowed with this command. ⚠️`
      }

      // prettier-ignore
      return (
        `"${lastElement}" is not a valid option. ⚠️\n\n` +
        `**Quality Options:** 4k, 1080p, 720p, 480p (and variations)\n\n` +
        `**Monitoring Options:**\n` +
        `**All** - Monitor all episodes except specials\n` +
        `**Future** - Monitor episodes that have not aired yet\n` +
        `**Missing** - Monitor episodes that do not have files or have not aired yet\n` +
        `**Existing** - Monitor episodes that have files or have not aired yet\n` +
        `**Recent** - Monitor episodes aired within the last 90 days and future episodes\n` +
        `**Pilot** - Only monitor the first episode of the first season\n` +
        `**FirstSeason** - Monitor all episodes of the first season. All other seasons will be ignored\n` +
        `**LastSeason** - Monitor all episodes of the last season\n` +
        allowSpecialOptions &&
        `**MonitorSpecials** - Monitor all special episodes without changing the monitored status of other episodes\n` +
        `**UnmonitorSpecials** - Unmonitor all special episodes without changing the monitored status of other episodes`
      )
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

  return {
    title,
    year,
    searchString: `${title} ${year}`,
    foundContentArr: [],
    monitor,
    quality,
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
