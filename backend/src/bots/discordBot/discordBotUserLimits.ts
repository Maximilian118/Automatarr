import { settingsDocType, UserType } from "../../models/settings"

// Calculate pool limits for a user
export const checkUserMovieLimit = (
  user: UserType,
  settings: settingsDocType,
): {
  limitError: string
  currentMax: string
  currentMovies: number
  currentLeft: number
} => {
  const currentMovies = user.pool.movies.length
  const noLimits = {
    limitError: "",
    currentMax: "∞",
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
      currentMax: max.toString(),
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
    currentMax: max.toString(),
    currentMovies,
    currentLeft,
  }
}
