import moment from "moment"
import { settingsType } from "../models/settings"
import { Movie } from "../types/movieTypes"
import { Series } from "../types/seriesTypes"
import {
  PlexContentType,
  entryWatchKeys,
  getCachedWatched,
  getPlexSessions,
  plexWatchReady,
  watchKeys,
} from "./plexRequests"

// Who has watched what on Plex, and what's playing now, for Radarr and Sonarr titles.
// This is the one thing Plex knows that Radarr and Sonarr don't.

// Anything watched by anyone within this many days is kept by library cleanup
export const WATCH_PROTECT_DAYS = 14

// The watch keys a Radarr film or Sonarr series can be found under: its IDs, then its title
const itemWatchKeys = (type: PlexContentType, item: Movie | Series): string[] =>
  watchKeys(
    type,
    { tmdbId: item.tmdbId, tvdbId: type === "series" ? (item as Series).tvdbId : null, imdbId: item.imdbId },
    item.title,
  ).concat(type === "movie" ? watchKeys(type, {}, item.title, item.year) : [])

// The latest time in a watched map for any of a title's keys, in ms. Null if never watched.
const latestFor = (watched: Map<string, number> | undefined, keys: string[]): number | null => {
  const times = keys.map((k) => watched?.get(k) ?? 0)
  const latest = Math.max(0, ...times)
  return latest || null
}

// When a Plex account last watched a film, or any episode of a series. Null if never, or no account.
export const lastWatched = (accountId: number | null, type: PlexContentType, item: Movie | Series): number | null =>
  accountId === null ? null : latestFor(getCachedWatched()[accountId], itemWatchKeys(type, item))

// When anyone on Plex last watched a film, or any episode of a series. Null if nobody has.
export const lastWatchedByAnyone = (type: PlexContentType, item: Movie | Series): number | null => {
  const keys = itemWatchKeys(type, item)
  const latest = Math.max(0, ...Object.values(getCachedWatched()).map((w) => latestFor(w, keys) ?? 0))
  return latest || null
}

// Whether a Plex account has watched a film or any episode of a series
export const hasWatchedOnPlex = (accountId: number | null, type: PlexContentType, item: Movie | Series): boolean =>
  lastWatched(accountId, type, item) !== null

// The watch keys of everything playing on Plex right now. Null if Plex can't be reached.
export const playingNow = async (settings: settingsType): Promise<Set<string> | null> => {
  const sessions = await getPlexSessions(settings)
  return sessions ? new Set(sessions.flatMap(entryWatchKeys)) : null
}

// Whether a film, or any episode of a series, is in a set of playing watch keys
export const isPlaying = (playing: Set<string>, type: PlexContentType, item: Movie | Series): boolean =>
  itemWatchKeys(type, item).some((k) => playing.has(k))

// Whether a film, or one episode of a series, is playing on Plex right now.
// False when Plex isn't connected or can't be reached, so it never blocks anything by itself.
export const playingOnPlex = async (
  settings: settingsType,
  type: PlexContentType,
  item: Movie | Series,
  episode?: { season: number; episode: number },
): Promise<boolean> => {
  if (!settings.plex_active) return false

  const sessions = await getPlexSessions(settings)
  const keys = new Set(itemWatchKeys(type, item))

  return (sessions ?? []).some(
    (s) =>
      entryWatchKeys(s).some((k) => keys.has(k)) &&
      (!episode || (Number(s.parentIndex) === episode.season && Number(s.index) === episode.episode)),
  )
}

// Why library cleanup should keep a title for now, or "" if Plex has no reason to.
// When Plex is connected but its data isn't available, the answer is to keep everything.
export const watchProtection = (
  settings: settingsType,
  type: PlexContentType,
  item: Movie | Series,
  playing: Set<string> | null,
): string => {
  if (!settings.plex_active) return ""
  if (!plexWatchReady() || !playing) return "Plex watch activity isn't available yet"
  if (isPlaying(playing, type, item)) return "someone is watching it on Plex right now"

  const last = lastWatchedByAnyone(type, item)
  if (last && moment().diff(moment(last), "days") < WATCH_PROTECT_DAYS) {
    return `watched on Plex ${moment(last).fromNow()}`
  }

  return ""
}

// A short watched date for display, e.g. "12 Mar" this year or "12 Mar 2025" before that
export const shortWatchedDate = (at: number): string =>
  moment(at).format(moment(at).isSame(moment(), "year") ? "D MMM" : "D MMM YYYY")
