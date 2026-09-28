import { dataDocType } from "../../../models/data"
import { settingsDocType } from "../../../models/settings"
import { Movie } from "../../../types/movieTypes"
import { Series } from "../../../types/seriesTypes"
import { truncateText } from "../../../shared/utility"
import { normalizeForComparison } from "../discordBotUtility"

// Get the cached Radarr and Sonarr libraries from the Data document
export const getLibraries = (data: dataDocType | null): { movies: Movie[]; series: Series[] } => ({
  movies: (data?.libraries.find((l) => l.name === "Radarr")?.data ?? []) as Movie[],
  series: (data?.libraries.find((l) => l.name === "Sonarr")?.data ?? []) as Series[],
})

// Names of users who have a movie or series in their pool. Pools are public via !list.
const poolOwners = (
  settings: settingsDocType,
  contentType: "movie" | "series",
  item: Movie | Series,
): string[] =>
  settings.general_bot.users
    .filter((u) =>
      contentType === "movie"
        ? u.pool.movies.some((m) => m.tmdbId === item.tmdbId)
        : u.pool.series.some((s) => s.tvdbId === (item as Series).tvdbId),
    )
    .map((u) => u.name)

// Describe a movie's ratings in one short line
const movieRatings = (movie: Movie): string =>
  [
    movie.ratings?.rottenTomatoes?.value ? `RT ${movie.ratings.rottenTomatoes.value}%` : "",
    movie.ratings?.imdb?.value ? `IMDb ${movie.ratings.imdb.value}` : "",
    movie.ratings?.tmdb?.value ? `TMDB ${movie.ratings.tmdb.value}` : "",
  ]
    .filter(Boolean)
    .join(", ") || "no ratings"

// Describe a movie compactly for the model
export const describeMovie = (movie: Movie, settings?: settingsDocType): string => {
  const owners = settings && movie.id ? poolOwners(settings, "movie", movie) : []

  return [
    `Movie: ${movie.title} (${movie.year})`,
    movie.id ? (movie.hasFile ? "in library, downloaded" : "in library, not downloaded yet") : "not in library",
    movieRatings(movie),
    movie.genres?.length ? `genres: ${movie.genres.slice(0, 4).join(", ")}` : "",
    movie.runtime ? `${movie.runtime} mins` : "",
    owners.length ? `in pools of: ${owners.join(", ")}` : "",
    movie.overview ? `overview: ${truncateText(movie.overview, 200)}` : "",
  ]
    .filter(Boolean)
    .join(" | ")
}

// Describe a series compactly for the model
export const describeSeries = (series: Series, settings?: settingsDocType): string => {
  const owners = settings && series.id ? poolOwners(settings, "series", series) : []
  const percent = series.statistics?.percentOfEpisodes

  return [
    `Series: ${series.title} (${series.year})`,
    series.id
      ? `in library, ${percent !== undefined ? `${Math.round(percent)}% downloaded` : "download status unknown"}`
      : "not in library",
    series.ratings?.value ? `rating ${series.ratings.value}/10` : "no rating",
    series.network ? `network: ${series.network}` : "",
    series.status ? `status: ${series.status}` : "",
    series.statistics?.seasonCount ? `${series.statistics.seasonCount} seasons` : "",
    series.genres?.length ? `genres: ${series.genres.slice(0, 4).join(", ")}` : "",
    owners.length ? `in pools of: ${owners.join(", ")}` : "",
    series.overview ? `overview: ${truncateText(series.overview, 200)}` : "",
  ]
    .filter(Boolean)
    .join(" | ")
}

// Check whether a library item matches a title and optional year
const matchesTitle = (item: { title: string; year: number }, title: string, year?: number): boolean => {
  const itemTitle = normalizeForComparison(item.title)
  const wanted = normalizeForComparison(title)
  const titleMatch = itemTitle === wanted || itemTitle.includes(wanted)

  return titleMatch && (!year || Number(item.year) === Number(year))
}

// Search the cached libraries for a title. Returns up to three matches of each type.
export const searchLibraries = (
  data: dataDocType | null,
  title: string,
  year?: number,
): { movies: Movie[]; series: Series[] } => {
  const { movies, series } = getLibraries(data)

  return {
    movies: movies.filter((m) => matchesTitle(m, title, year)).slice(0, 3),
    series: series.filter((s) => matchesTitle(s, title, year)).slice(0, 3),
  }
}
