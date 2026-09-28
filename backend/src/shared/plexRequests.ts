import axios from "axios"
import moment from "moment"
import logger from "../logger"
import { settingsType } from "../models/settings"
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

type PlexMetadata = {
  ratingKey?: string | number
  type?: string
  title?: string
  grandparentTitle?: string
  parentIndex?: number
  index?: number
  year?: number
  viewedAt?: number
  viewOffset?: number
  duration?: number
  Guid?: PlexGuid[]
  User?: { id?: string | number }
}

type PlexMediaContainer = {
  Account?: { id: string | number; name?: string }[]
  Metadata?: PlexMetadata[]
}

// In-memory cache of recent Plex activity, refreshed by the get_data loop
type PlexCache = {
  accounts: PlexAccount[]
  history: Record<number, PlexWatchItem[]> // Keyed by Plex account ID
  updated_at: string | null
}

const plexCache: PlexCache = {
  accounts: [],
  history: {},
  updated_at: null,
}

// Movie metadata lookups are cached by ratingKey so repeated history refreshes stay cheap
const movieMetaCache = new Map<string, { year: number | null; tmdbId: number | null }>()

// How many history items to keep per Plex account
const HISTORY_LIMIT = 15

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

// Extract a TMDB ID from a Plex Guid array, e.g. [{ id: "tmdb://603" }]
const tmdbIdFromGuids = (guids: PlexGuid[] | undefined): number | null => {
  const tmdb = (guids ?? []).find((g) => typeof g.id === "string" && g.id.startsWith("tmdb://"))
  return tmdb ? Number(tmdb.id.replace("tmdb://", "")) || null : null
}

// Look up the year and TMDB ID for a movie by its Plex ratingKey
const getMovieMeta = async (
  settings: settingsType,
  ratingKey: string,
): Promise<{ year: number | null; tmdbId: number | null }> => {
  const cached = movieMetaCache.get(ratingKey)
  if (cached) return cached

  try {
    const container = await plexGet(
      settings.plex_URL,
      settings.plex_KEY,
      `/library/metadata/${ratingKey}`,
      { includeGuids: 1 },
    )
    const meta = container.Metadata?.[0]
    const result = { year: meta?.year ?? null, tmdbId: tmdbIdFromGuids(meta?.Guid) }
    movieMetaCache.set(ratingKey, result)
    return result
  } catch {
    // Items deleted from the library can no longer be looked up
    const result = { year: null, tmdbId: null }
    movieMetaCache.set(ratingKey, result)
    return result
  }
}

// Convert a raw Plex Metadata object into a PlexWatchItem
const toWatchItem = async (settings: settingsType, meta: PlexMetadata): Promise<PlexWatchItem> => {
  const isMovie = meta.type === "movie"
  const isEpisode = meta.type === "episode"
  const movieMeta = isMovie && meta.ratingKey ? await getMovieMeta(settings, String(meta.ratingKey)) : null

  return {
    type: isMovie ? "movie" : isEpisode ? "episode" : "other",
    title: String(meta.title ?? ""),
    show_title: isEpisode ? String(meta.grandparentTitle ?? "") : null,
    season: isEpisode ? Number(meta.parentIndex ?? 0) : null,
    episode: isEpisode ? Number(meta.index ?? 0) : null,
    year: movieMeta?.year ?? meta.year ?? null,
    tmdbId: movieMeta?.tmdbId ?? tmdbIdFromGuids(meta.Guid),
    viewed_at: meta.viewedAt ? moment.unix(Number(meta.viewedAt)).format() : null,
    progress:
      meta.viewOffset && meta.duration
        ? Math.round((Number(meta.viewOffset) / Number(meta.duration)) * 100)
        : null,
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

  return Promise.all(items.slice(0, HISTORY_LIMIT).map((item) => toWatchItem(settings, item)))
}

// Refresh the in-memory Plex cache with accounts and recent history for every account
export const refreshPlexCache = async (settings: settingsType): Promise<void> => {
  if (!settings.plex_active || !settings.plex_URL || !settings.plex_KEY) return

  try {
    const accounts = await getPlexAccounts(settings)
    const history: Record<number, PlexWatchItem[]> = {}

    for (const account of accounts) {
      history[account.id] = await getPlexHistory(settings, account.id)
    }

    plexCache.accounts = accounts
    plexCache.history = history
    plexCache.updated_at = moment().format()
    logger.info(`Plex | Cached watch history for ${accounts.length} accounts.`)
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

// Get cached watch history for a Plex account
export const getCachedPlexHistory = (accountId: number): PlexWatchItem[] =>
  plexCache.history[accountId] ?? []

// Get what a Plex account is watching right now
export const getPlexNowPlaying = async (
  settings: settingsType,
  accountId: number,
): Promise<PlexWatchItem[]> => {
  if (!settings.plex_active) return []

  try {
    const container = await plexGet(settings.plex_URL, settings.plex_KEY, "/status/sessions")
    const sessions = container.Metadata ?? []
    const mine = sessions.filter((s) => Number(s.User?.id) === accountId)

    return Promise.all(mine.map((s) => toWatchItem(settings, s)))
  } catch (err) {
    logger.error(`Plex | Failed to get sessions: ${axiosErrorMessage(err)}`)
    return []
  }
}

// Describe a watch item in a short human readable form
export const describeWatchItem = (item: PlexWatchItem): string => {
  if (item.type === "episode") {
    return `${item.show_title} S${String(item.season).padStart(2, "0")}E${String(item.episode).padStart(2, "0")} "${item.title}"`
  }

  return item.year ? `${item.title} (${item.year})` : item.title
}
