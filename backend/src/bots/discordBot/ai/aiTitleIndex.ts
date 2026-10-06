import Data, { library } from "../../../models/data"
import logger from "../../../logger"
import { Movie } from "../../../types/movieTypes"
import { Series } from "../../../types/seriesTypes"
import { Episode } from "../../../types/episodeTypes"
import { titleKey } from "../../../shared/plexRequests"

// In-memory index of every film and series in the Radarr and Sonarr libraries, rebuilt whenever the
// libraries are refreshed. Matching titles here is free, so the AI can be handed relevant library facts
// without spending a tool round on them.

export type IndexContentType = "movie" | "series"

export type IndexedTitle = {
  type: IndexContentType
  item: Movie | Series // The library item as Radarr or Sonarr returned it
  keys: string[] // Title keys for the title and every alternate title
  words: Set<string> // Every word of every title, as title keys
  mainWords: string[] // The meaningful words of the main title, e.g. "men" and "black" for "Men in Black"
  fileAddedAt: number // When its newest file was downloaded, in ms. 0 if it has none
  score: number // Match score, only set on results of a search
}

// A free text query split into its title part and an optional year
type ParsedQuery = { key: string; words: string[]; year?: number }

// Words that carry no meaning in a title search
const STOP_WORDS = new Set(["the", "a", "an", "of", "and", "is", "it", "on", "in", "to", "for", "film", "movie", "series", "show"])

// Longest run of message words checked against titles, e.g. "the lord of the rings the two towers"
const MAX_TITLE_WORDS = 8

// Shortest title key a message can match by itself. Stops titles like "Up" or "It" matching chat.
const MIN_MESSAGE_KEY_LENGTH = 6

// Single word titles must be at least this long to match a message, so "Friends" or "Heat" in chat aren't titles
const MIN_SINGLE_WORD_KEY_LENGTH = 9

// Multi word titles need at least one meaningful word this long, so "The One" in chat isn't a title
const MIN_MEANINGFUL_WORD_LENGTH = 4

// Score a title needs to count as a match in a search
export const MATCH_THRESHOLD = 40

let entries: IndexedTitle[] = []
let byKey = new Map<string, IndexedTitle[]>()
let built = false // Whether the index has been built at least once, even if the libraries were empty
let loading: Promise<void> | null = null

// Split a title into word keys. Hyphenated and joined forms are both kept, so "Spider-Man" gives
// "spider", "man" and "spiderman".
const titleWords = (title: string): string[] => {
  const spaced = title.replace(/['’]/g, "").split(/[^\p{L}\p{N}]+/u).map(titleKey).filter(Boolean)
  const joined = title.split(/\s+/).map(titleKey).filter(Boolean)
  return [...spaced, ...joined]
}

// The words of a title that carry meaning, without stop words
const meaningfulWords = (title: string): string[] =>
  title.replace(/['’]/g, "").split(/[^\p{L}\p{N}]+/u).map(titleKey).filter((w) => w && !STOP_WORDS.has(w))

// Every title a library item is known by
const allTitles = (item: Movie | Series): string[] => [
  item.title,
  ...(item.alternateTitles ?? []).map((t) => t.title),
  ...("originalTitle" in item && item.originalTitle ? [item.originalTitle] : []),
]

// Build the index entry for one library item. A film's download date comes from its file, a series'
// from its newest episode file, given separately because Sonarr keeps episodes apart from the series.
const toEntry = (type: IndexContentType, item: Movie | Series, newestEpisodeAt: number = 0): IndexedTitle => {
  const titles = allTitles(item)
  const movieFileAt = type === "movie" ? Date.parse(String((item as Movie).movieFile?.dateAdded ?? "")) || 0 : 0

  return {
    type,
    item,
    keys: [...new Set(titles.map(titleKey).filter(Boolean))],
    words: new Set(titles.flatMap(titleWords)),
    mainWords: meaningfulWords(item.title),
    fileAddedAt: type === "movie" ? movieFileAt : newestEpisodeAt,
    score: 0,
  }
}

// When each series' newest episode file was downloaded, in ms, keyed by Sonarr series ID
const newestEpisodeFiles = (episodes: Episode[]): Map<number, number> => {
  const newest = new Map<number, number>()

  for (const episode of episodes) {
    const at = Date.parse(String(episode.episodeFile?.dateAdded ?? "")) || 0
    if (at > (newest.get(episode.seriesId) ?? 0)) newest.set(episode.seriesId, at)
  }

  return newest
}

// Rebuild the key lookup from the current entries
const rebuildKeys = (): void => {
  byKey = new Map()
  entries.forEach((entry) =>
    entry.keys.forEach((key) => byKey.set(key, [...(byKey.get(key) ?? []), entry])),
  )
}

// Rebuild the whole index from freshly fetched libraries
export const rebuildTitleIndex = (libraries: library[]): void => {
  const movies = (libraries.find((l) => l.name === "Radarr")?.data ?? []) as Movie[]
  const sonarr = libraries.find((l) => l.name === "Sonarr")
  const series = (sonarr?.data ?? []) as Series[]
  const episodeDates = newestEpisodeFiles((sonarr?.episodes ?? []) as Episode[])

  entries = [
    ...movies.map((m) => toEntry("movie", m)),
    ...series.map((s) => toEntry("series", s, episodeDates.get(s.id))),
  ]
  rebuildKeys()
  built = true
}

// Add or replace one item, e.g. straight after it's requested, so it shows up before the next refresh
export const indexTitle = (type: IndexContentType, item: Movie | Series): void => {
  if (!item?.id) return

  const existing = entries.find((e) => e.type === type && e.item.id === item.id)
  entries = [
    ...entries.filter((e) => e !== existing),
    toEntry(type, item, existing?.fileAddedAt),
  ]
  rebuildKeys()
}

// Make sure the index is loaded. On a fresh boot it's built from the stored libraries until the
// first refresh replaces it. Only the episode fields needed for download dates are read.
export const ensureTitleIndex = async (): Promise<void> => {
  if (built) return

  loading ??= Data.findOne(
    {},
    {
      "libraries.name": 1,
      "libraries.data": 1,
      "libraries.episodes.seriesId": 1,
      "libraries.episodes.episodeFile.dateAdded": 1,
    },
  )
    .lean()
    .then((data) => rebuildTitleIndex((data?.libraries ?? []) as library[]))
    .catch((err) => {
      logger.error(`AI Bot | Failed to load the title index: ${err}`)
    })
    .finally(() => {
      loading = null
    })

  await loading
}

// Every indexed title. Used for browsing the library.
export const indexedTitles = (): IndexedTitle[] => entries

// Find the indexed library item for a TMDB or TVDB ID
export const indexedById = (type: IndexContentType, externalId: number): IndexedTitle | undefined =>
  entries.find((e) =>
    e.type === type && (type === "movie" ? e.item.tmdbId === externalId : (e.item as Series).tvdbId === externalId),
  )

// Pull a 4 digit year out of a query, e.g. "spiderman 2026" gives "spiderman" and 2026
const parseQuery = (text: string, year?: number): ParsedQuery => {
  const yearMatch = year ? null : text.match(/\b(19|20)\d{2}\b/)
  const titleText = yearMatch ? text.replace(yearMatch[0], " ") : text

  return {
    key: titleKey(titleText),
    words: titleWords(titleText).filter((w) => !STOP_WORDS.has(w)),
    year: year ?? (yearMatch ? Number(yearMatch[0]) : undefined),
  }
}

// How much a year moves a score: exact matches rise, near misses a little, wrong years sink
const yearAdjustment = (itemYear: number, year?: number): number => {
  if (!year) return 0
  const gap = Math.abs(Number(itemYear) - year)
  return gap === 0 ? 20 : gap === 1 ? 10 : -25
}

// Score how well a title matches a query. 0 means no match at all.
// Whole titles beat prefixes, prefixes beat substrings, and loose word matches come last.
type ScoreTarget = { keys: string[]; words: Set<string>; mainWords: string[]; year: number }

export const scoreTitle = (target: ScoreTarget, query: ParsedQuery): number => {
  const { key, words } = query
  if (!key) return 0

  let score = 0

  if (target.keys.includes(key)) score = 100
  else if (key.length >= 4 && target.keys.some((k) => k.startsWith(key))) score = 85
  else if (key.length >= 4 && target.keys.some((k) => k.includes(key))) score = 75
  else if (words.length) {
    const covered = words.filter((w) => target.words.has(w) || (w.length >= 4 && target.keys.some((k) => k.includes(w))))
    const ratio = covered.length / words.length
    const titleInQuery = target.mainWords.join("").length >= MIN_MESSAGE_KEY_LENGTH && target.mainWords.every((w) => words.includes(w))
    if (ratio === 1) score = 60
    else if (titleInQuery) score = 55 // Extra words around a whole title, e.g. "the original men in black"
    else if (ratio >= 0.6 && words.length >= 2) score = Math.round(45 * ratio)
  }

  return score ? score + yearAdjustment(target.year, query.year) : 0
}

// Score a library item or lookup result against a query
export const scoreItem = (item: Movie | Series, query: ParsedQuery): number =>
  scoreTitle({ ...toEntry("movie", item), year: item.year }, query)

// Order matches by score, then by popularity and recency so the likeliest title comes first
const byRelevance = (a: IndexedTitle, b: IndexedTitle): number =>
  b.score - a.score ||
  (("popularity" in b.item ? b.item.popularity : 0) ?? 0) - (("popularity" in a.item ? a.item.popularity : 0) ?? 0) ||
  b.item.year - a.item.year

// Search the library for a title, tolerating spacing, punctuation, accents, alternate titles and near years
export const searchTitleIndex = (
  text: string,
  options: { year?: number; type?: IndexContentType; limit?: number } = {},
): IndexedTitle[] => {
  const query = parseQuery(text, options.year)

  return entries
    .filter((e) => !options.type || e.type === options.type)
    .map((e) => ({ ...e, score: scoreTitle({ ...e, year: e.item.year }, query) }))
    .filter((e) => e.score >= MATCH_THRESHOLD)
    .sort(byRelevance)
    .slice(0, options.limit ?? 5)
}

// Build a query the same way a search does, for scoring results from elsewhere
export const buildQuery = (text: string, year?: number): ParsedQuery => parseQuery(text, year)

// Whether a run of message words is distinctive enough to be a title without a false alarm
const distinctiveRun = (key: string, runWords: string[]): boolean => {
  if (key.length < MIN_MESSAGE_KEY_LENGTH) return false
  if (runWords.length === 1) return key.length >= MIN_SINGLE_WORD_KEY_LENGTH
  return runWords.some((w) => !STOP_WORDS.has(w) && w.length >= MIN_MEANINGFUL_WORD_LENGTH)
}

// Find library titles named in a chat message, e.g. "is spider man brand new day out yet?".
// Runs of neighbouring words are joined and looked up, so spacing and punctuation don't matter.
// A year in the message filters to titles from around then. Returns nothing rather than guessing.
export const titlesInMessage = (text: string, limit: number = 3): IndexedTitle[] => {
  const yearMatch = text.match(/\b(19|20)\d{2}\b/)
  const year = yearMatch ? Number(yearMatch[0]) : undefined
  const words = text.split(/\s+/).map(titleKey).filter(Boolean)
  const found: { entry: IndexedTitle; start: number; end: number }[] = []

  for (let start = 0; start < words.length; start++) {
    let joined = ""
    for (let end = start; end < Math.min(words.length, start + MAX_TITLE_WORDS); end++) {
      joined += words[end]
      const matches = distinctiveRun(joined, words.slice(start, end + 1)) ? byKey.get(joined) ?? [] : []
      matches.forEach((entry) => found.push({ entry, start, end }))
    }
  }

  // Keep the longest match for each stretch of the message, e.g. "Men in Black II" over "Men in Black"
  const longest = found.filter(
    (f) => !found.some((o) => o !== f && o.start <= f.start && o.end >= f.end && o.end - o.start > f.end - f.start),
  )

  const unique = [...new Map(longest.map((f) => [`${f.entry.type}:${f.entry.item.id}`, f.entry])).values()]
  const scored = unique.map((e) => ({ ...e, score: 100 + yearAdjustment(e.item.year, year) }))
  const relevant = year ? scored.filter((e) => Math.abs(e.item.year - year) <= 1) : scored

  return relevant.sort(byRelevance).slice(0, limit)
}
