import { settingsDocType, UserType } from "../../models/settings"

// Helper
const movieLimitResult = (
  user: UserType,
  max: number,
  current: number,
): {
  limitError: string
  currentMovieMax: string
  currentMovies: number
  currentLeft: number
} => {
  const currentLeft = Math.max(0, max - current)
  return {
    limitError:
      currentLeft <= 0
        ? `Sorry ${user.name}. You've reached your movie pool limit of ${max}. Please delete a movie before adding a new one.`
        : "",
    currentMovieMax: max.toString(),
    currentMovies: current,
    currentLeft,
  }
}

// Calculate movie pool limits for a user
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
    return movieLimitResult(user, user.max_movies_overwrite, currentMovies)

  const generalMax = settings.general_bot.max_movies
  if (generalMax == null) return noLimits

  const effectiveMax = user.super_user ? generalMax * 2 : generalMax
  return movieLimitResult(user, effectiveMax, currentMovies)
}

// Helper
const seriesLimitResult = (
  user: UserType,
  max: number,
  current: number,
): {
  limitError: string
  currentSeriesMax: string
  currentSeries: number
  currentLeft: number
} => {
  const currentLeft = Math.max(0, max - current)
  return {
    limitError:
      currentLeft <= 0
        ? `Sorry ${user.name}. You've reached your series pool limit of ${max}. Please delete a series before adding a new one.`
        : "",
    currentSeriesMax: max.toString(),
    currentSeries: current,
    currentLeft,
  }
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
    return seriesLimitResult(user, user.max_series_overwrite, currentSeries)

  const generalMax = settings.general_bot.max_series
  if (generalMax == null) return noLimits

  const effectiveMax = user.super_user ? generalMax * 2 : generalMax
  return seriesLimitResult(user, effectiveMax, currentSeries)
}
