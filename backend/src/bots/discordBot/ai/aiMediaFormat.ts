import moment from "moment"
import { dataDocType } from "../../../models/data"
import { settingsDocType } from "../../../models/settings"
import { Movie } from "../../../types/movieTypes"
import { Series } from "../../../types/seriesTypes"
import { truncateText } from "../../../shared/utility"
import { resolutionToQualityGroup } from "../discordBotUtility"
import { releaseWait } from "../../../shared/downloadStatus"
import { shortWatchedDate } from "../../../shared/plexWatch"

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

// Format a Radarr or Sonarr date for the model, e.g. "31 Jul 2026". Empty if missing or invalid.
const formatDate = (date?: string): string => {
  const parsed = date ? moment(date) : null
  return parsed?.isValid() ? parsed.format("D MMM YYYY") : ""
}

// Describe a dated release milestone in the past or future tense, e.g. "digital release due 14 Oct 2026"
const describeMilestone = (label: string, date?: string): string => {
  const formatted = formatDate(date)
  if (!formatted) return ""

  return moment(date).isAfter(moment()) ? `${label} due ${formatted}` : `${label} ${formatted}`
}

// Plain English for each Radarr release status
const releaseStages: Record<Movie["status"], string> = {
  announced: "announced, not in cinemas yet",
  inCinemas: "in cinemas now",
  released: "released",
}

// Describe where a film is in its release cycle and whether Automatarr can grab it yet,
// using the dates Radarr already tracks. Lets the model answer "is it out yet?" without guessing.
// Skipped for downloaded films, where it's no longer useful.
const movieRelease = (movie: Movie): string => {
  if (movie.hasFile) return ""

  const stage = releaseStages[movie.status] ?? ""

  const milestones = [
    describeMilestone("cinemas", movie.inCinemas),
    describeMilestone("digital release", movie.digitalRelease),
    describeMilestone("physical release", movie.physicalRelease),
  ].filter(Boolean)

  const parts = [stage, ...milestones, releaseWait(movie)].filter(Boolean)
  return parts.length ? `release: ${parts.join(", ")}` : ""
}

// Extra facts a description can carry beyond the library item itself
export type DescribeExtras = {
  settings?: settingsDocType // Adds who has it in their pool
  queue?: string // Live download status, e.g. "downloading in 1080p, 22 minutes left"
  watchedAt?: number | null // When the speaker last watched it on Plex, in ms
  overviewLength?: number // How much of the overview to include. 0 leaves it out
}

// Default overview length, short enough to keep a list of results cheap
const OVERVIEW_LENGTH = 200

// Turn a Starr resolution into a quality label, e.g. 2160 gives "4K" and 1080 gives "1080p"
export const qualityLabel = (resolution?: number): string => {
  const group = resolutionToQualityGroup(resolution)
  if (!group) return ""
  return group === "4k" ? "4K" : `${group}p`
}

// Describe whether a movie is downloaded, downloading, or waiting
const movieStatus = (movie: Movie, queue?: string): string => {
  if (!movie.id) return "not in library"
  if (movie.hasFile) {
    const quality = qualityLabel(movie.movieFile?.quality?.quality?.resolution)
    return `in library, downloaded${quality ? ` in ${quality}` : ""}`
  }
  return queue ? `in library, ${queue}` : "in library, not downloaded yet"
}

// Describe how much of a series is downloaded, plus anything downloading now
const seriesStatus = (series: Series, queue?: string): string => {
  if (!series.id) return "not in library"
  const percent = series.statistics?.percentOfEpisodes
  const downloaded = percent !== undefined ? `${Math.round(percent)}% downloaded` : "download status unknown"
  return `in library, ${downloaded}${queue ? `, ${queue}` : ""}`
}

// The facts shared by films and series at the end of a description
const commonTail = (item: Movie | Series, extras: DescribeExtras, owners: string[]): string[] => {
  const overviewLength = extras.overviewLength ?? OVERVIEW_LENGTH

  return [
    extras.watchedAt ? `the speaker watched it on Plex (${shortWatchedDate(extras.watchedAt)})` : "",
    owners.length ? `in pools of: ${owners.join(", ")}` : "",
    overviewLength && item.overview ? `overview: ${truncateText(item.overview, overviewLength)}` : "",
  ]
}

// Describe a movie compactly for the model
export const describeMovie = (movie: Movie, extras: DescribeExtras = {}): string => {
  const owners = extras.settings && movie.id ? poolOwners(extras.settings, "movie", movie) : []

  return [
    `Movie: ${movie.title} (${movie.year})`,
    movieStatus(movie, extras.queue),
    movieRelease(movie),
    movieRatings(movie),
    movie.genres?.length ? `genres: ${movie.genres.slice(0, 4).join(", ")}` : "",
    movie.runtime ? `${movie.runtime} mins` : "",
    ...commonTail(movie, extras, owners),
  ]
    .filter(Boolean)
    .join(" | ")
}

// Describe a series compactly for the model
export const describeSeries = (series: Series, extras: DescribeExtras = {}): string => {
  const owners = extras.settings && series.id ? poolOwners(extras.settings, "series", series) : []

  return [
    `Series: ${series.title} (${series.year})`,
    seriesStatus(series, extras.queue),
    series.ratings?.value ? `rating ${series.ratings.value}/10` : "no rating",
    series.network ? `network: ${series.network}` : "",
    series.status ? `status: ${series.status}` : "",
    describeMilestone("next episode", series.nextAiring),
    series.statistics?.seasonCount ? `${series.statistics.seasonCount} seasons` : "",
    series.genres?.length ? `genres: ${series.genres.slice(0, 4).join(", ")}` : "",
    ...commonTail(series, extras, owners),
  ]
    .filter(Boolean)
    .join(" | ")
}

// A title's rating on a 0 to 10 scale, from Rotten Tomatoes or IMDb for films and TVDB for series. 0 if unrated.
export const ratingOutOf10 = (type: "movie" | "series", item: Movie | Series): number => {
  if (type === "series") return (item as Series).ratings?.value ?? 0

  const ratings = (item as Movie).ratings
  return ratings?.rottenTomatoes?.value ? ratings.rottenTomatoes.value / 10 : (ratings?.imdb?.value ?? 0)
}

// Describe a movie or series by content type
export const describeItem = (type: "movie" | "series", item: Movie | Series, extras: DescribeExtras = {}): string =>
  type === "movie" ? describeMovie(item as Movie, extras) : describeSeries(item as Series, extras)

// A one line summary for browsing lists: title, ratings and genres only
export const describeBrief = (type: "movie" | "series", item: Movie | Series): string =>
  [
    `${item.title} (${item.year})`,
    type === "movie" ? "film" : "series",
    type === "movie" ? movieRatings(item as Movie) : (item as Series).ratings?.value ? `rating ${(item as Series).ratings.value}/10` : "",
    item.genres?.length ? item.genres.slice(0, 3).join(", ") : "",
  ]
    .filter(Boolean)
    .join(" | ")
