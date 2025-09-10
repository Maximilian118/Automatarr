import { settingsType, settingsDocType } from "../models/settings"
import Settings from "../models/settings"
import logger from "../logger"
import { activeAPIsArr } from "../shared/activeAPIsArr"
import { downloadMovie } from "../shared/RadarrStarrRequests"
import { downloadSeries } from "../shared/SonarrStarrRequests"
import { findQualityProfile, findRootFolder } from "../bots/discordBot/discordBotUtility"
import { Movie } from "../types/movieTypes"
import { Series } from "../types/seriesTypes"
import { saveWithRetry } from "../shared/database"
import moment from "moment"

const userPoolContentChecker = async (settings: settingsType): Promise<void> => {
  logger.info("User Pool Content Checker | Starting content verification.")

  // Only get data for API's that have been checked and are active
  const { data, activeAPIs } = await activeAPIsArr(settings)

  // Find Radarr and Sonarr APIs
  const radarrAPI = activeAPIs.find((api) => api.name === "Radarr")
  const sonarrAPI = activeAPIs.find((api) => api.name === "Sonarr")

  if (!radarrAPI && !sonarrAPI) {
    logger.info("User Pool Content Checker | No active Radarr or Sonarr APIs found")
    return
  }

  // Get current library data
  const radarrLibrary = radarrAPI?.data.library as Movie[] | undefined
  const sonarrLibrary = sonarrAPI?.data.library as Series[] | undefined

  let missingMovies = 0
  let missingSeries = 0
  let reAddedMovies = 0
  let reAddedSeries = 0
  let updatedMovies = 0
  let updatedSeries = 0

  // Re-fetch settings to get latest user data
  const currentSettings = (await Settings.findOne()) as settingsDocType
  if (!currentSettings) {
    logger.error("User Pool Content Checker | Could not fetch settings from database")
    return
  }

  // Check each user's pool content
  for (const user of currentSettings.general_bot.users) {
    // Check movies in user's pool
    if (user.pool.movies && user.pool.movies.length > 0 && radarrLibrary && radarrAPI) {
      for (const poolMovie of user.pool.movies) {
        // Check if movie exists in Radarr library
        const movieInLibrary = radarrLibrary.find(
          (movie) =>
            movie.tmdbId === poolMovie.tmdbId ||
            movie.imdbId === poolMovie.imdbId ||
            (movie.title === poolMovie.title && movie.year === poolMovie.year),
        )

        if (movieInLibrary) {
          // Movie exists in Radarr - check if user pool data needs updating
          const needsUpdate =
            movieInLibrary.id !== poolMovie.id ||
            movieInLibrary.monitored !== poolMovie.monitored ||
            movieInLibrary.hasFile !== poolMovie.hasFile ||
            movieInLibrary.status !== poolMovie.status ||
            JSON.stringify(movieInLibrary.movieFile) !== JSON.stringify(poolMovie.movieFile)

          if (needsUpdate) {
            logger.info(
              `User Pool Content Checker | Updating stale movie data: ${poolMovie.title} (${poolMovie.year}) for user ${user.name}`,
            )

            // Update the movie data in user's pool with current info from Radarr
            const userIndex = currentSettings.general_bot.users.findIndex((u) => u._id === user._id)
            if (userIndex !== -1) {
              const movieIndex = currentSettings.general_bot.users[userIndex].pool.movies.findIndex(
                (m) =>
                  m.tmdbId === poolMovie.tmdbId ||
                  (m.title === poolMovie.title && m.year === poolMovie.year),
              )
              if (movieIndex !== -1) {
                currentSettings.general_bot.users[userIndex].pool.movies[movieIndex] =
                  movieInLibrary
                currentSettings.general_bot.users[userIndex].updated_at = moment().format()
                currentSettings.markModified(`general_bot.users.${userIndex}.pool.movies`)
                updatedMovies++
              }
            }
          }
        } else {
          // Movie is genuinely missing from Radarr library
          missingMovies++

          // Add the movie to Radarr and start download
          try {
            // Get quality profile
            const selectedQP = settings.general_bot.movie_quality_profile
            if (!selectedQP) {
              logger.error("User Pool Content Checker | No movie quality profile selected")
              continue
            }

            const qualityProfile = findQualityProfile(selectedQP, data, "Radarr")
            if (typeof qualityProfile === "string") {
              logger.error(`User Pool Content Checker | Quality profile error: ${qualityProfile}`)
              continue
            }

            // Get root folder
            const rootFolder = findRootFolder(data, "Radarr")
            if (typeof rootFolder === "string") {
              logger.error(`User Pool Content Checker | Root folder error: ${rootFolder}`)
              continue
            }

            // Add movie to Radarr
            const addedMovie = await downloadMovie(
              currentSettings,
              poolMovie,
              qualityProfile.id,
              rootFolder.path,
            )

            if (addedMovie) {
              logger.success(
                `User Pool Content Checker | Added missing movie to Radarr: ${poolMovie.title} (${poolMovie.year}) for user ${user.name}`,
              )
              reAddedMovies++

              // Update the movie data in user's pool with new info from Radarr
              const userIndex = currentSettings.general_bot.users.findIndex(
                (u) => u._id === user._id,
              )
              if (userIndex !== -1) {
                const movieIndex = currentSettings.general_bot.users[
                  userIndex
                ].pool.movies.findIndex(
                  (m) =>
                    m.tmdbId === poolMovie.tmdbId ||
                    (m.title === poolMovie.title && m.year === poolMovie.year),
                )
                if (movieIndex !== -1) {
                  currentSettings.general_bot.users[userIndex].pool.movies[movieIndex] = addedMovie
                  currentSettings.general_bot.users[userIndex].updated_at = moment().format()
                  currentSettings.markModified(`general_bot.users.${userIndex}.pool.movies`)
                }
              }
            } else {
              logger.error(
                `User Pool Content Checker | Failed to add movie: ${poolMovie.title} (${poolMovie.year})`,
              )
            }
          } catch (error) {
            logger.error(
              `User Pool Content Checker | Error adding movie ${poolMovie.title}: ${error}`,
            )
          }
        }
      }
    }

    // Check series in user's pool
    if (user.pool.series && user.pool.series.length > 0 && sonarrLibrary && sonarrAPI) {
      for (const poolSeries of user.pool.series) {
        // Check if series exists in Sonarr library
        const seriesInLibrary = sonarrLibrary.find(
          (series) =>
            series.tvdbId === poolSeries.tvdbId ||
            series.imdbId === poolSeries.imdbId ||
            (series.title === poolSeries.title && series.year === poolSeries.year),
        )

        if (seriesInLibrary) {
          // Series exists in Sonarr - check if user pool data needs updating
          const needsUpdate =
            seriesInLibrary.id !== poolSeries.id ||
            seriesInLibrary.monitored !== poolSeries.monitored ||
            seriesInLibrary.statistics?.episodeFileCount !==
              poolSeries.statistics?.episodeFileCount ||
            seriesInLibrary.statistics?.episodeCount !== poolSeries.statistics?.episodeCount ||
            seriesInLibrary.status !== poolSeries.status ||
            seriesInLibrary.ended !== poolSeries.ended

          if (needsUpdate) {
            logger.info(
              `User Pool Content Checker | Updating stale series data: ${poolSeries.title} (${poolSeries.year}) for user ${user.name}`,
            )

            // Update the series data in user's pool with current info from Sonarr
            const userIndex = currentSettings.general_bot.users.findIndex((u) => u._id === user._id)
            if (userIndex !== -1) {
              const seriesIndex = currentSettings.general_bot.users[
                userIndex
              ].pool.series.findIndex(
                (s) =>
                  s.tvdbId === poolSeries.tvdbId ||
                  (s.title === poolSeries.title && s.year === poolSeries.year),
              )
              if (seriesIndex !== -1) {
                currentSettings.general_bot.users[userIndex].pool.series[seriesIndex] =
                  seriesInLibrary
                currentSettings.general_bot.users[userIndex].updated_at = moment().format()
                currentSettings.markModified(`general_bot.users.${userIndex}.pool.series`)
                updatedSeries++
              }
            }
          }
        } else {
          // Series is genuinely missing from Sonarr library
          missingSeries++

          // Add the series to Sonarr and start download
          try {
            // Get quality profile
            const selectedQP = settings.general_bot.series_quality_profile
            if (!selectedQP) {
              logger.error("User Pool Content Checker | No series quality profile selected")
              continue
            }

            const qualityProfile = findQualityProfile(selectedQP, data, "Sonarr")
            if (typeof qualityProfile === "string") {
              logger.error(`User Pool Content Checker | Quality profile error: ${qualityProfile}`)
              continue
            }

            // Get root folder
            const rootFolder = findRootFolder(data, "Sonarr")
            if (typeof rootFolder === "string") {
              logger.error(`User Pool Content Checker | Root folder error: ${rootFolder}`)
              continue
            }

            // Add series to Sonarr
            const addedSeries = await downloadSeries(
              currentSettings,
              poolSeries,
              qualityProfile.id,
              rootFolder.path,
            )

            if (addedSeries) {
              logger.success(
                `User Pool Content Checker | Added missing series to Sonarr: ${poolSeries.title} (${poolSeries.year}) for user ${user.name}`,
              )
              reAddedSeries++

              // Update the series data in user's pool with new info from Sonarr
              const userIndex = currentSettings.general_bot.users.findIndex(
                (u) => u._id === user._id,
              )
              if (userIndex !== -1) {
                const seriesIndex = currentSettings.general_bot.users[
                  userIndex
                ].pool.series.findIndex(
                  (s) =>
                    s.tvdbId === poolSeries.tvdbId ||
                    (s.title === poolSeries.title && s.year === poolSeries.year),
                )
                if (seriesIndex !== -1) {
                  currentSettings.general_bot.users[userIndex].pool.series[seriesIndex] =
                    addedSeries
                  currentSettings.general_bot.users[userIndex].updated_at = moment().format()
                  currentSettings.markModified(`general_bot.users.${userIndex}.pool.series`)
                }
              }
            } else {
              logger.error(
                `User Pool Content Checker | Failed to add series: ${poolSeries.title} (${poolSeries.year})`,
              )
            }
          } catch (error) {
            logger.error(
              `User Pool Content Checker | Error adding series ${poolSeries.title}: ${error}`,
            )
          }
        }
      }
    }
  }

  // Save updated settings if any changes were made
  if (reAddedMovies > 0 || reAddedSeries > 0 || updatedMovies > 0 || updatedSeries > 0) {
    if (await saveWithRetry(currentSettings, "userPoolContentChecker")) {
      logger.success("User Pool Content Checker | Updated user pools saved to database")
    } else {
      logger.error("User Pool Content Checker | Failed to save updated user pools to database")
    }
  }

  logger.info(
    `User Pool Content Checker | Complete - Missing: ${missingMovies} movies, ${missingSeries} series | Added: ${reAddedMovies} movies, ${reAddedSeries} series | Updated: ${updatedMovies} movies, ${updatedSeries} series`,
  )
}

export default userPoolContentChecker
