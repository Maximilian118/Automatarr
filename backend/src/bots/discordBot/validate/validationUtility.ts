import { Channel, GuildTextBasedChannel, TextBasedChannel } from "discord.js"
import { settingsDocType } from "../../../models/settings"
import { searchRadarr } from "../../../shared/RadarrStarrRequests"
import { searchSonarr } from "../../../shared/SonarrStarrRequests"
import { getDiscordClient } from "../discordBot"
import { discordReply } from "../discordBotUtility"
import { isTextBasedChannel } from "../discordBotTypeGuards"
import { Movie } from "../../../types/movieTypes"
import { MonitorOptions, Series } from "../../../types/seriesTypes"
import { dataDocType } from "../../../models/data"

// All recognized quality argument strings for matching user input
const qualityKeywords = [
  "4k", "2160", "2160p", "2160i", "uhd", "ultra",
  "1080", "1080p", "1080i", "fhd", "fullhd", "full-hd",
  "720", "720p", "720i",
  "480", "480p", "480i", "sd",
]

// Check if a string is a recognized quality keyword (e.g., "4k", "1080p", "uhd")
const isQualityArg = (str: string): boolean =>
  qualityKeywords.includes(str.toLowerCase().trim())

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

  // Check if a string is a valid monitor option (case insensitive)
  const isMonitorOption = (str: string): boolean =>
    validMonitorOptions.some((opt) => opt.toLowerCase() === str.replace(/\s+/g, "").toLowerCase())

  // Step 1: Find the year by scanning from the end of the array.
  // Skip over any recognized quality or monitor args.
  // The first 4-digit number that isn't a quality keyword is the year.
  let yearIndex = -1

  for (let i = rest.length - 1; i >= 0; i--) {
    const el = rest[i]

    // Skip recognized quality and monitor args
    if (isMonitorOption(el) || isQualityArg(el)) continue

    // First 4-digit number that isn't a quality keyword is the year
    if (el.match(/^\d{4}$/) && !isQualityArg(el)) {
      yearIndex = i
      break
    }

    // Unrecognized element — keep scanning to find the year
  }

  // No year found — show error with search recommendations
  if (yearIndex === -1) {
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

  // Step 2: Extract title, year, and trailing arguments
  const title = rest.slice(0, yearIndex).join(" ")
  const year = rest[yearIndex]
  const trailingArgs = rest.slice(yearIndex + 1)

  // Validate the title is not empty
  if (!title.trim()) {
    return `A title must be provided before the year. For example: !download ${
      contentType === "movie" ? "Top Gun 1986" : "Breaking Bad 2008"
    }`
  }

  // Step 3: Categorize each trailing argument as a monitor option, quality, or error
  let monitor: MonitorOptions = "all"
  let quality: string | undefined

  for (const arg of trailingArgs) {
    const normalizedArg = arg.replace(/\s+/g, "").toLowerCase()

    if (isMonitorOption(arg)) {
      monitor = validMonitorOptions.find((opt) => opt.toLowerCase() === normalizedArg)!
      continue
    }

    if (isQualityArg(arg)) {
      quality = arg
      continue
    }

    // "none" is explicitly not allowed as a monitor option
    if (normalizedArg === "none") {
      return `The "none" monitoring option is not allowed ever. ⚠️`
    }

    // monitorSpecials/unmonitorSpecials when not allowed for this command
    if (normalizedArg === "monitorspecials" || normalizedArg === "unmonitorspecials") {
      return `The "${arg}" monitoring option is not allowed with this command. ⚠️`
    }

    // Build a helpful error message for unrecognized trailing arguments
    const specialOptions = allowSpecialOptions
      ? `**MonitorSpecials** - Monitor all special episodes without changing the monitored status of other episodes\n` +
        `**UnmonitorSpecials** - Unmonitor all special episodes without changing the monitored status of other episodes`
      : ""

    return (
      `"${arg}" is not a valid option. ⚠️\n\n` +
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
      specialOptions
    )
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
