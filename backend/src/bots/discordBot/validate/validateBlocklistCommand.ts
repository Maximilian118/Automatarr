import { Message } from "discord.js"
import { settingsDocType } from "../../../models/settings"
import { dataDocType } from "../../../models/data"
import { Movie } from "../../../types/movieTypes"
import { Series } from "../../../types/seriesTypes"
import { extractSeasonEpisode } from "../../../shared/qBittorrentUtility"
import { channelValid } from "./validationUtility"

// Validate the array data for the caseBlocklist message
export const validateBlocklistCommand = async (
  message: Message,
  settings: settingsDocType,
  data: dataDocType,
): Promise<
  | string
  | {
      command: string
      contentType: "movie" | "series"
      title: string
      searchString: string
      noMatchMessage: string
      movieDBList: Movie[]
      seriesDBList: Series[]
      year: string
      seasonNumber?: number
      episodeNumber?: number
    }
> => {
  const validCommands = ["!blocklist", "!dud"]

  // Check if an accepted channel has been used
  const validChannel = channelValid(message.channel, settings)
  if (typeof validChannel === "string") return validChannel

  const { contentType } = validChannel

  const msgArr = message.content.trim().split(/\s+/)

  if (msgArr.length < 2) {
    return "The !blocklist command must contain at least two parts: `!blocklist <movieTitle Year>` or `!blocklist <seriesTitle Year SxxEyy>`, e.g. `!blocklist Dune 2021` or `!blocklist The Bear 2022 S02E04`."
  }

  const [command, ...rest] = msgArr
  const typeLower = contentType.toLowerCase()
  const singular = typeLower.includes("movie") ? "movie" : "series"

  if (!validCommands.includes(command.toLowerCase())) {
    return `Invalid command \`${command}\`. Use one of these: ${validCommands.join(", ")}.`
  }

  const rawInput = rest.join(" ").trim()
  // Normalize "S01 E02" to "S01E02" for easier parsing
  const cleanedInput = rawInput.replace(/\b(S\d{1,2})\s+(E\d{1,2})\b/i, "$1$2")

  const movieDBList = (data.libraries.find((api) => api.name === "Radarr")?.data as Movie[]) || []
  const seriesDBList = (data.libraries.find((api) => api.name === "Sonarr")?.data as Series[]) || []

  // Check for season/episode pattern (e.g., S01E02, Season 1 Episode 2, etc.)
  const seasonEpisode = extractSeasonEpisode(cleanedInput)

  if (seasonEpisode) {
    // Series: requires title + year + season/episode
    // Remove season/episode pattern to get title + year
    const withoutSeasonEp = cleanedInput
      .replace(/s(\d{1,2})e(\d{1,2})/i, "")
      .replace(/season[\s]?(\d{1,2})[\s_-]*episode[\s]?(\d{1,2})/i, "")
      .trim()

    // Extract year (should be at the end of what remains)
    const parts = withoutSeasonEp.split(" ")
    const lastPart = parts[parts.length - 1]
    const yearMatch = lastPart?.match(/^\d{4}$/)

    if (!yearMatch) {
      // No year found - provide helpful suggestions from library
      const likelyTitle = withoutSeasonEp.replace(/\b\d{4}\b/, "").trim().toLowerCase()
      const suggestions = seriesDBList
        .filter((s) => s.title.toLowerCase().includes(likelyTitle))
        .slice(0, 10)
        .map((s) => `${s.title} ${s.year}`)
        .join("\n")

      return (
        `A 4-digit year must be included after the title. ⚠️\n` +
        `Usage: \`!blocklist <seriesTitle> <year> <SxxEyy>\`\n` +
        `Example: \`!blocklist The Bear 2022 S02E04\`\n\n` +
        (suggestions ? `I've found these in your library: 📚\n${suggestions}` : "")
      )
    }

    const year = lastPart
    const title = parts.slice(0, -1).join(" ").trim()
    const searchString = `${title} ${year}`

    const noMatchMessage = `I can't find anything that matches "${rawInput}".\n`

    return {
      command,
      contentType: "series",
      title,
      searchString,
      movieDBList,
      seriesDBList,
      noMatchMessage,
      year,
      seasonNumber: seasonEpisode.season,
      episodeNumber: seasonEpisode.episode,
    }
  }

  // Movie or series without season/episode (error for series)
  if (singular === "series") {
    // Series requires season/episode
    const likelyTitle = rawInput.replace(/\b\d{4}\b/, "").trim().toLowerCase()
    const suggestions = seriesDBList
      .filter((s) => s.title.toLowerCase().includes(likelyTitle))
      .slice(0, 10)
      .flatMap((series) => {
        const output: string[] = []
        series.seasons
          ?.filter((season) => season.seasonNumber > 0)
          .forEach((season) => {
            const seasonNumber = season.seasonNumber.toString().padStart(2, "0")
            const epCount = season.statistics?.episodeFileCount || "?"
            output.push(`${series.title} ${series.year} S${seasonNumber}E01-${epCount}`)
          })
        return output
      })
      .join("\n")

    return (
      `For series, include a year and episode. ⚠️\n` +
      `Usage: \`!blocklist <seriesTitle> <year> <SxxEyy>\`\n` +
      `Example: \`!blocklist The Bear 2022 S02E04\`\n\n` +
      (suggestions ? `I've found these in your library: 📚\n${suggestions}` : "")
    )
  }

  // Movie: requires title + 4-digit year
  const parts = rawInput.split(" ")
  const last = parts[parts.length - 1]
  const yearMatch = last?.match(/^\d{4}$/)

  if (!yearMatch) {
    // No year found - provide helpful suggestions from library
    const likelyTitle = rawInput.replace(/\b\d{4}\b/, "").trim().toLowerCase()
    const suggestions = movieDBList
      .filter((m) => m.title.toLowerCase().includes(likelyTitle))
      .slice(0, 10)
      .map((m) => `${m.title} ${m.year}`)
      .join("\n")

    return (
      `A 4-digit year must be included after the title. ⚠️\n` +
      `Usage: \`!blocklist <movieTitle> <year>\`\n` +
      `Example: \`!blocklist Dune 2021\`\n\n` +
      (suggestions ? `I've found these in your library: 📚\n${suggestions}` : "")
    )
  }

  const year = last
  const title = parts.slice(0, -1).join(" ").trim()
  const searchString = `${title} ${year}`

  const noMatchMessage = `I can't find anything that matches "${rawInput}".\n`

  return {
    command,
    contentType: "movie",
    title,
    searchString,
    movieDBList,
    seriesDBList,
    noMatchMessage,
    year,
  }
}
