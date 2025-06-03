import { settingsDocType, UserType } from "../../models/settings"
import { capsFirstLetter } from "../../shared/utility"

// Helper for both movie and series limits
const limitResult = (
  user: UserType,
  max: number,
  currentCount: number,
  type: "movie" | "series",
) => {
  const currentLeft = max - currentCount
  const label = type === "movie" ? "movie" : "series"

  return {
    limitError:
      currentLeft <= 0
        ? `Sorry ${user.name}. You've reached your ${label} pool limit of ${max}. Please delete a ${label} before adding a new one.`
        : "",
    [`current${capsFirstLetter(label)}Max`]: max.toString(),
    [`current${capsFirstLetter(label)}`]: currentCount,
    currentLeft,
  } as any // `as any` to satisfy dynamic keys without more complex type gymnastics
}

export const checkUserMovieLimit = (
  user: UserType,
  settings: settingsDocType,
): {
  limitError: string
  currentMovieMax: string
  currentMovies: number
  currentLeft: number
} => {
  const currentMovies = user.pool.movies.length
  const noLimits = {
    limitError: "",
    currentMovieMax: "∞",
    currentMovies,
    currentLeft: Infinity,
  }

  if (user.admin) return noLimits
  if (user.max_movies_overwrite != null)
    return limitResult(user, user.max_movies_overwrite, currentMovies, "movie")

  const generalMax = settings.general_bot.max_movies
  if (generalMax == null) return noLimits

  const effectiveMax = user.super_user ? generalMax * 2 : generalMax
  return limitResult(user, effectiveMax, currentMovies, "movie")
}

// Calculate series pool limits for a user
export const checkUserSeriesLimit = (
  user: UserType,
  settings: settingsDocType,
): {
  limitError: string
  currentSeriesMax: string
  currentSeries: number
  currentLeft: number
} => {
  const currentSeries = user.pool.series.length
  const noLimits = {
    limitError: "",
    currentSeriesMax: "∞",
    currentSeries,
    currentLeft: Infinity,
  }

  if (user.admin) return noLimits

  if (user.max_series_overwrite != null)
    return limitResult(user, user.max_series_overwrite, currentSeries, "series")

  const generalMax = settings.general_bot.max_series
  if (generalMax == null) return noLimits

  const effectiveMax = user.super_user ? generalMax * 2 : generalMax
  return limitResult(user, effectiveMax, currentSeries, "series")
}
