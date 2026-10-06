import axios from "axios"
import moment from "moment"
import logger from "../logger"
import { BotUserType, settingsType } from "../models/settings"
import { cleanUrl } from "./utility"
import { axiosErrorMessage } from "./requestError"

// A Plex account that has access to the Plex Media Server
export type PlexAccount = {
  id: number
  name: string
}

// A single item from Plex watch history or a currently playing session
export type PlexWatchItem = {
  type: "movie" | "episode" | "other"
  title: string // Movie title or episode title
  show_title: string | null // Series title for episodes
  season: number | null
  episode: number | null
  year: number | null
  tmdbId: number | null // Only resolved for movies
  viewed_at: string | null // When the item was watched. Null for live sessions
  progress: number | null // Percentage watched for live sessions
}

// The subset of Plex API response fields Automatarr reads
type PlexGuid = { id: string }

export type PlexMetadata = {
  ratingKey?: string | number
  grandparentRatingKey?: string | number // The show, for an episode
  type?: string
  title?: string
  grandparentTitle?: string
  parentIndex?: number
  index?: number
  year?: number
  viewedAt?: number
  viewOffset?: number
  duration?: number
  guid?: string // Legacy agents put their single ID here, e.g. com.plexapp.agents.imdb://tt0133093?lang=en
  Guid?: PlexGuid[] // Newer agents list every ID, e.g. [{ id: "tmdb://603" }, { id: "imdb://tt0133093" }]
  User?: { id?: string | number }
}

type PlexSection = { key: string | number; type: string; title?: string }

type PlexMediaContainer = {
  Account?: { id: string | number; name?: string }[]
  Metadata?: PlexMetadata[]
  Directory?: PlexSection[]
}

// What kind of title a Plex item is, in Radarr/Sonarr terms
export type PlexContentType = "movie" | "series"

// The IDs that tie a Plex film or show to Radarr or Sonarr
export type PlexIds = {
  type: PlexContentType
  title: string
  year: number | null
  tmdbId: number | null
  tvdbId: number | null
  imdbId: string | null
}

// In-memory cache of Plex activity, refreshed by the get_data loop. Only IDs and watch dates are kept,
// never the library itself, because Radarr and Sonarr already describe everything on the server.
type PlexCache = {
  accounts: PlexAccount[]
  history: Record<number, PlexWatchItem[]> // Recent watches per Plex account ID
  ids: Map<string, PlexIds> // Every film and show in Plex, keyed by ratingKey
  watched: Record<number, Map<string, number>> // Watch keys (see watchKeys) to last watched time in ms, per account
  updated_at: string | null // When the cache last refreshed successfully. Null until the first refresh.
}

const plexCache: PlexCache = {
  accounts: [],
  history: {},
  ids: new Map(),
  watched: {},
  updated_at: null,
}

// How many history items to keep per Plex account
const HISTORY_LIMIT = 15

// How far back each account's watched history reaches, per library section, so episodes don't crowd out films
const WATCHED_LIMIT = 1000

// Library items read per request when building the ID map
const SECTION_PAGE_SIZE = 500

// Reduce a title to lowercase letters and digits, with accents folded, so titles compare reliably
export const titleKey = (title: string): string =>
  title
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]/g, "")


// Headers required for every Plex request
const plexHeaders = (token: string) => ({
  Accept: "application/json",
  "X-Plex-Token": token,
  "X-Plex-Client-Identifier": "automatarr",
  "X-Plex-Product": "Automatarr",
})

// Perform a GET against the Plex Media Server and return the MediaContainer
const plexGet = async (
  URL: string,
  KEY: string,
  path: string,
  params?: Record<string, string | number>,
): Promise<PlexMediaContainer> => {
  const res = await axios.get(cleanUrl(`${URL}${path}`), {
    headers: plexHeaders(KEY),
    params,
    timeout: 10000,
  })

  return res.data?.MediaContainer ?? {}
}

// Check the Plex Media Server connection. Returns the HTTP status code.
export const checkPlexConnection = async (URL: string, KEY: string): Promise<number> => {
  try {
    const res = await axios.get(cleanUrl(`${URL}/identity`), {
      headers: plexHeaders(KEY),
      timeout: 10000,
    })

    // /identity doesn't require a token, so confirm the token works too
    await plexGet(URL, KEY, "/accounts")

    return res.status
  } catch (err) {
    logger.error(`Plex | Error: ${axiosErrorMessage(err)}`)
    return 500
  }
}

// Get every Plex account that has access to the server
const getPlexAccounts = async (settings: settingsType): Promise<PlexAccount[]> => {
  const container = await plexGet(settings.plex_URL, settings.plex_KEY, "/accounts")
  const accounts = container.Account ?? []

  return accounts
    .filter((a) => a.name)
    .map((a) => ({ id: Number(a.id), name: String(a.name) }))
}

// Read an ID out of a Plex GUID, e.g. "tmdb://603" or "com.plexapp.agents.themoviedb://603?lang=en"
const guidValue = (guids: string[], prefixes: string[]): string | null => {
  for (const guid of guids) {
    const prefix = prefixes.find((p) => guid.startsWith(p))
    if (prefix) return guid.slice(prefix.length).split("?")[0] || null
  }
  return null
}

// Pull the TMDB, TVDB and IMDb IDs from a Plex item, from both the new Guid list and legacy agent GUIDs
export const idsFromGuids = (meta: Pick<PlexMetadata, "guid" | "Guid">): Pick<PlexIds, "tmdbId" | "tvdbId" | "imdbId"> => {
  const guids = [...(meta.Guid ?? []).map((g) => g.id), meta.guid ?? ""].filter((g): g is string => typeof g === "string")
  const tmdb = guidValue(guids, ["tmdb://", "com.plexapp.agents.themoviedb://"])
  const tvdb = guidValue(guids, ["tvdb://", "com.plexapp.agents.thetvdb://"])

  return {
    tmdbId: Number(tmdb) || null,
    tvdbId: Number(tvdb) || null,
    imdbId: guidValue(guids, ["imdb://", "com.plexapp.agents.imdb://"]),
  }
}

// The keys a watch is stored under: one per ID it has, plus its title as a fallback for anything
// Plex no longer knows the IDs of, e.g. "movie:tmdb:603", "series:tvdb:81189", "movie:title:thefly:1986"
export const watchKeys = (
  type: PlexContentType,
  ids: Partial<Pick<PlexIds, "tmdbId" | "tvdbId" | "imdbId">>,
  title?: string,
  year?: number | null,
): string[] =>
  [
    ids.tmdbId ? `${type}:tmdb:${ids.tmdbId}` : "",
    ids.tvdbId ? `${type}:tvdb:${ids.tvdbId}` : "",
    ids.imdbId ? `${type}:imdb:${ids.imdbId}` : "",
    title ? `${type}:title:${titleKey(title)}${year ? `:${year}` : ""}` : "",
  ].filter(Boolean)

// Find the film or show a history or session entry belongs to: the film itself, or an episode's show
export const plexIdsFor = (meta: PlexMetadata): PlexIds | undefined => {
  const key = meta.type === "episode" ? meta.grandparentRatingKey : meta.ratingKey
  return key !== undefined ? plexCache.ids.get(String(key)) : undefined
}

// The watch keys for a history or session entry, by ID when Plex still has the item, otherwise by title
export const entryWatchKeys = (meta: PlexMetadata): string[] => {
  const ids = plexIdsFor(meta)
  if (ids) return watchKeys(ids.type, ids)
  if (meta.type === "movie" && meta.title) return watchKeys("movie", {}, meta.title, meta.year)
  if (meta.type === "episode" && meta.grandparentTitle) return watchKeys("series", {}, meta.grandparentTitle)
  return []
}

// Convert a raw Plex Metadata object into a PlexWatchItem. Year and TMDB ID come from the ID map.
const toWatchItem = (meta: PlexMetadata): PlexWatchItem => {
  const isMovie = meta.type === "movie"
  const isEpisode = meta.type === "episode"
  const ids = isMovie ? plexIdsFor(meta) : undefined

  return {
    type: isMovie ? "movie" : isEpisode ? "episode" : "other",
    title: String(meta.title ?? ""),
    show_title: isEpisode ? String(meta.grandparentTitle ?? "") : null,
    season: isEpisode ? Number(meta.parentIndex ?? 0) : null,
    episode: isEpisode ? Number(meta.index ?? 0) : null,
    year: ids?.year ?? meta.year ?? null,
    tmdbId: ids?.tmdbId ?? idsFromGuids(meta).tmdbId,
    viewed_at: meta.viewedAt ? moment.unix(Number(meta.viewedAt)).format() : null,
    progress:
      meta.viewOffset && meta.duration
        ? Math.round((Number(meta.viewOffset) / Number(meta.duration)) * 100)
        : null,
  }
}

// Get the film and TV library sections. Music and photo libraries are skipped.
const getPlexSections = async (settings: settingsType): Promise<PlexSection[]> => {
  const container = await plexGet(settings.plex_URL, settings.plex_KEY, "/library/sections")
  return (container.Directory ?? []).filter((d) => d.type === "movie" || d.type === "show")
}

// Read every film or show in a section and map its ratingKey to its IDs, a page at a time
const mapSectionIds = async (settings: settingsType, section: PlexSection, ids: Map<string, PlexIds>): Promise<void> => {
  const type: PlexContentType = section.type === "movie" ? "movie" : "series"

  for (let start = 0; ; start += SECTION_PAGE_SIZE) {
    const container = await plexGet(settings.plex_URL, settings.plex_KEY, `/library/sections/${section.key}/all`, {
      includeGuids: 1,
      "X-Plex-Container-Start": start,
      "X-Plex-Container-Size": SECTION_PAGE_SIZE,
    })
    const items = container.Metadata ?? []

    items.forEach((item) => {
      if (item.ratingKey === undefined) return
      ids.set(String(item.ratingKey), { type, title: String(item.title ?? ""), year: item.year ?? null, ...idsFromGuids(item) })
    })

    if (items.length < SECTION_PAGE_SIZE) return
  }
}

// Get the most recent watch history for a single Plex account
const getPlexHistory = async (settings: settingsType, accountId: number): Promise<PlexWatchItem[]> => {
  const container = await plexGet(settings.plex_URL, settings.plex_KEY, "/status/sessions/history/all", {
    sort: "viewedAt:desc",
    accountID: accountId,
    "X-Plex-Container-Start": 0,
    "X-Plex-Container-Size": HISTORY_LIMIT,
  })
  const items = container.Metadata ?? []

  return items.slice(0, HISTORY_LIMIT).map(toWatchItem)
}

// Get when a Plex account last watched each film and show, from a long stretch of its history in
// each library section. Keyed by watch key, so lookups work by TMDB, TVDB or IMDb ID.
const getPlexWatched = async (
  settings: settingsType,
  accountId: number,
  sections: PlexSection[],
): Promise<Map<string, number>> => {
  const watched = new Map<string, number>()

  for (const section of sections) {
    const container = await plexGet(settings.plex_URL, settings.plex_KEY, "/status/sessions/history/all", {
      sort: "viewedAt:desc",
      accountID: accountId,
      librarySectionID: section.key,
      "X-Plex-Container-Start": 0,
      "X-Plex-Container-Size": WATCHED_LIMIT,
    })

    for (const entry of container.Metadata ?? []) {
      const at = Number(entry.viewedAt ?? 0) * 1000
      for (const key of entryWatchKeys(entry)) {
        if (at > (watched.get(key) ?? 0)) watched.set(key, at)
      }
    }
  }

  return watched
}

// Refresh the in-memory Plex cache: accounts, the ID map, recent history and when each account last
// watched each title. The ID map is built first because history is resolved through it.
export const refreshPlexCache = async (settings: settingsType): Promise<void> => {
  if (!settings.plex_active || !settings.plex_URL || !settings.plex_KEY) return

  try {
    const accounts = await getPlexAccounts(settings)
    const sections = await getPlexSections(settings)
    const ids = new Map<string, PlexIds>()

    for (const section of sections) await mapSectionIds(settings, section, ids)
    plexCache.ids = ids

    const history: Record<number, PlexWatchItem[]> = {}
    const watched: Record<number, Map<string, number>> = {}

    for (const account of accounts) {
      history[account.id] = await getPlexHistory(settings, account.id)
      watched[account.id] = await getPlexWatched(settings, account.id, sections)
    }

    plexCache.accounts = accounts
    plexCache.history = history
    plexCache.watched = watched
    plexCache.updated_at = moment().format()
    logger.info(`Plex | Mapped ${ids.size} titles and cached watch history for ${accounts.length} accounts.`)
  } catch (err) {
    logger.error(`Plex | Failed to refresh watch history: ${axiosErrorMessage(err)}`)
  }
}

// Find the Plex account ID for a name. Matching is case insensitive.
export const findPlexAccountId = (names: string[]): number | null => {
  const lowered = names.filter(Boolean).map((n) => n.toLowerCase())
  const account = plexCache.accounts.find((a) => lowered.includes(a.name.toLowerCase()))
  return account ? account.id : null
}

// Every Plex account with access to the server, from the cache
export const getCachedPlexAccounts = (): PlexAccount[] => plexCache.accounts

// Find the Plex account ID for a bot user. A saved link always wins. Unlinked users are matched by name.
export const plexAccountForUser = (botUser: BotUserType | undefined, discordUsername: string): number | null => {
  if (botUser?.plex_account_id != null) return botUser.plex_account_id
  if (botUser?.plex_username) return findPlexAccountId([botUser.plex_username])

  return findPlexAccountId([botUser?.name ?? "", discordUsername])
}

// Get cached watch history for a Plex account
export const getCachedPlexHistory = (accountId: number): PlexWatchItem[] =>
  plexCache.history[accountId] ?? []

// When each title was last watched, per Plex account, keyed by watch key
export const getCachedWatched = (): Record<number, Map<string, number>> => plexCache.watched

// Whether the Plex cache has refreshed successfully since Automatarr started
export const plexWatchReady = (): boolean => plexCache.updated_at !== null

// Get every film or episode being played on Plex right now, by any account. Null if Plex can't be reached.
export const getPlexSessions = async (settings: settingsType): Promise<PlexMetadata[] | null> => {
  try {
    const container = await plexGet(settings.plex_URL, settings.plex_KEY, "/status/sessions")
    return container.Metadata ?? []
  } catch (err) {
    logger.error(`Plex | Failed to get sessions: ${axiosErrorMessage(err)}`)
    return null
  }
}

// Get what a Plex account is watching right now
export const getPlexNowPlaying = async (
  settings: settingsType,
  accountId: number,
): Promise<PlexWatchItem[]> => {
  if (!settings.plex_active) return []

  const sessions = (await getPlexSessions(settings)) ?? []
  return sessions.filter((s) => Number(s.User?.id) === accountId).map(toWatchItem)
}

// Describe a watch item in a short human readable form
export const describeWatchItem = (item: PlexWatchItem): string => {
  if (item.type === "episode") {
    return `${item.show_title} S${String(item.season).padStart(2, "0")}E${String(item.episode).padStart(2, "0")} "${item.title}"`
  }

  return item.year ? `${item.title} (${item.year})` : item.title
}
