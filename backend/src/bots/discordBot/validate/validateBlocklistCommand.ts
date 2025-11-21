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
      noMatchMessage: string
      movieDBList: Movie[]
      seriesDBList: Series[]
      year?: number
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
    return "The !blocklist command must contain at least two parts: \`!blocklist <movieTitle + Year / seriesTitle SxxEyy>\`, e.g. \`!blocklist Dune 2021\` or \`!blocklist The Bear S02E04\`."
  }

  const [command, ...rest] = msgArr
  const typeLower = contentType.toLowerCase()
  const singular = typeLower.includes("movie") ? "movie" : "series"

  if (!validCommands.includes(command.toLowerCase())) {
    return `Invalid command \`${command}\`. Use one of these: ${validCommands.join(", ")}.`
  }

  const rawInput = rest.join(" ").trim()
  const cleanedInput = rawInput.replace(/\\b(S\\d{1,2})\\s+(E\\d{1,2})\\b/i, "$1$2")

  const noMatchMessage = `I can't find anything that matches ${rawInput}.\n${
    singular === "movie"
      ? `For movies, use a year (e.g., "Dune 2021").`
      : `For series, include an episode (e.g., "The Office S02E01" or "The Office Season 2 Episode 1")`
  }.\n\n`

  let suggestions: (Movie | Series)[] = []
  const movieDBList = (data.libraries.find((api) => api.name === "Radarr")?.data as Movie[]) || []
  const seriesDBList = (data.libraries.find((api) => api.name === "Sonarr")?.data as Series[]) || []

  // Check for season/episode pattern (e.g., S01E02, Season 1 Episode 2, etc.)
  const seasonEpisode = extractSeasonEpisode(cleanedInput)

  if (seasonEpisode) {
    const title = cleanedInput
      .replace(/s(\\d{1,2})e(\\d{1,2})/i, "")
      .replace(/season[\\s]?(\\d{1,2})[\\s_-]*episode[\\s]?(\\d{1,2})/i, "")
      .trim()

    return {
      command,
      contentType: "series",
      title,
      movieDBList,
      seriesDBList,
      noMatchMessage,
      seasonNumber: seasonEpisode.season,
      episodeNumber: seasonEpisode.episode,
    }
  }

  if (singular === "movie") {
    // Check for movie title + 4-digit year
    const parts = rawInput.split(" ")
    const last = parts[parts.length - 1]
    const yearMatch = last.match(/^\\d{4}$/)

    if (yearMatch) {
      const year = parseInt(last, 10)
      const title = parts.slice(0, -1).join(" ").trim()
      return {
        command,
        contentType: "movie",
        title,
        movieDBList,
        seriesDBList,
        noMatchMessage,
        year,
      }
    }
  }

  const likelyTitle = rawInput
    .replace(/\\bseason[\\s]?(\\d{1,2})[\\s_-]*episode[\\s]?(\\d{1,2})\\b/i, "") // Remove season episode
    .replace(/\\bs(\\d{1,2})e(\\d{1,2})\\b/i, "") // Remove s**e**
    .replace(/\\b\\d{4}\\b/, "") // Remove 4-digit year
    .trim()
    .toLowerCase()

  if (singular === "movie") {
    suggestions = movieDBList.filter((m) => m.title.toLowerCase().includes(likelyTitle))
  } else {
    suggestions = seriesDBList.filter((s) => s.title.toLowerCase().includes(likelyTitle))
  }

  const suggestionStrings =
    suggestions.length > 0
      ? suggestions
          .flatMap((s, i) => {
            if (singular === "movie") {
              const movie = s as Movie
              return [`${i}. ${movie.title} ${movie.year}`]
            } else {
              const series = s as Series
              const seriesTitle = series.title
              const output: string[] = []

              series.seasons
                ?.filter((season) => season.seasonNumber > 0)
                .forEach((season) => {
                  const seasonNumber = season.seasonNumber.toString().padStart(2, "0")
                  const epCount = season.statistics?.episodeFileCount || "?"
                  output.push(`${i}. ${seriesTitle} S${seasonNumber} E1-${epCount}`)
                })

              return output
            }
          })
          .join("\n")
      : false

  return (
    noMatchMessage + (suggestionStrings ? `Did you mean any of these?\n` + suggestionStrings : "")
  )
}
