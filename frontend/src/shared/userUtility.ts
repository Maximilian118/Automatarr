import { BotUserType, settingsType } from "../types/settingsType"

export type PoolItemType = "movies" | "series"

// Anything that might carry size information: a pool movie (sizeOnDisk) or a pool series (per-season statistics)
interface SizedItem {
  sizeOnDisk?: number
  seasons?: { statistics?: { sizeOnDisk?: number } }[]
}

// Bytes on disk for a single pool item. Series sum the size of every season
export const poolItemBytes = (item: SizedItem, itemType: PoolItemType): number => {
  if (itemType === "movies") return item.sizeOnDisk || 0

  return (item.seasons ?? []).reduce((total, season) => total + (season.statistics?.sizeOnDisk || 0), 0)
}

// Total bytes on disk across everything in a user's pool
export const calculateUserTotalStorageBytes = (user: BotUserType): number =>
  user.pool.movies.reduce((total, movie) => total + poolItemBytes(movie as SizedItem, "movies"), 0) +
  user.pool.series.reduce((total, series) => total + poolItemBytes(series as SizedItem, "series"), 0)

// The pool limit that applies to a user for one content type: admins are unlimited,
// per-user overrides win, then the general limit (doubled for super users)
const userLimit = (user: BotUserType, override: number | null, generalMax: number | null): string => {
  if (user.admin) return "∞"
  if (override != null) return override.toString()
  if (generalMax == null) return "∞"
  return (user.super_user ? generalMax * 2 : generalMax).toString()
}

// The movie pool limit that applies to a user
export const calculateUserMovieLimit = (user: BotUserType, settings: settingsType): string =>
  userLimit(user, user.max_movies_overwrite, settings.general_bot.max_movies)

// The series pool limit that applies to a user
export const calculateUserSeriesLimit = (user: BotUserType, settings: settingsType): string =>
  userLimit(user, user.max_series_overwrite, settings.general_bot.max_series)
