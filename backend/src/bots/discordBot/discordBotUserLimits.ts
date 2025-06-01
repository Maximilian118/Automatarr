import { settingsDocType, UserType } from "../../models/settings"

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

  // Admins have infinite limits
  if (user.admin) {
    return noLimits
  }

  // Super user logic
  if (user.super_user) {
    const max = user.max_movies_overwrite
    if (max == null) {
      return noLimits
    }

    const currentLeft = max - currentMovies

    return {
      limitError:
        currentLeft <= 0
          ? `Sorry ${user.name}. You've reached your movie pool limit of ${max}. Please delete a movie before adding a new one.`
          : "",
      currentMovieMax: max.toString(),
      currentMovies,
      currentLeft,
    }
  }

  // Standard user limit
  const max = settings.general_bot.max_movies
  if (max == null) {
    return noLimits
  }

  const currentLeft = max - currentMovies

  return {
    limitError:
      currentLeft <= 0
        ? `Sorry ${user.name}. You've reached your movie pool limit of ${max}. Please delete a movie before adding a new one.`
        : "",
    currentMovieMax: max.toString(),
    currentMovies,
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

  // Admins have infinite limits
  if (user.admin) {
    return noLimits
  }

  // Super user logic
  if (user.super_user) {
    const max = user.max_series_overwrite
    if (max == null) {
      return noLimits
    }

    const currentLeft = max - currentSeries

    return {
      limitError:
        currentLeft <= 0
          ? `Sorry ${user.name}. You've reached your series pool limit of ${max}. Please delete a series before adding a new one.`
          : "",
      currentSeriesMax: max.toString(),
      currentSeries,
      currentLeft,
    }
  }

  // Standard user limit
  const max = settings.general_bot.max_series
  if (max == null) {
    return noLimits
  }

  const currentLeft = max - currentSeries

  return {
    limitError:
      currentLeft <= 0
        ? `Sorry ${user.name}. You've reached your series pool limit of ${max}. Please delete a series before adding a new one.`
        : "",
    currentSeriesMax: max.toString(),
    currentSeries,
    currentLeft,
  }
}
