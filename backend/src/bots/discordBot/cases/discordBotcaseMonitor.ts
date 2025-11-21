import { Message } from "discord.js"
import Settings, { settingsDocType } from "../../../models/settings"
import Data, { dataDocType } from "../../../models/data"
import {
  checkSeriesInImportList,
  checkUserExclusivity,
  discordReply,
  findRootFolder,
  freeSpaceCheck,
  matchedUser,
  noDBPull,
  sendDiscordMessage,
  seriesMatches,
} from "../discordBotUtility"
import { validateMonitorCommand } from "../discordRequestValidation"
import { checkUserSeriesLimit } from "../discordBotUserLimits"
import {
  randomNotFoundMessage,
  randomProcessingMessage,
  randomMonitorUpgradeMessage,
  randomMonitorDowngradeMessage,
  randomMonitorAddedToPoolMessage,
  randomMonitorSpecialsMessage,
  randomUnmonitorSpecialsMessage,
} from "../discordBotRandomReply"
import { saveWithRetry } from "../../../shared/database"
import {
  searchSonarr,
  updateSeriesMonitor,
  getSonarrSeries,
  searchMonitoredSeries,
} from "../../../shared/SonarrStarrRequests"
import { sortTMDBSearchArray } from "../../botUtility"
import { Series } from "../../../types/seriesTypes"

// Change a Series monitoring options
export const caseMonitor = async (message: Message): Promise<string> => {
  await sendDiscordMessage(message, randomProcessingMessage())

  const settings = (await Settings.findOne()) as settingsDocType
  if (!settings) return noDBPull()

  const data = (await Data.findOne()) as dataDocType
  if (!data) return noDBPull()

  // Check if Sonarr is connected
  if (!settings.sonarr_active) {
    return discordReply("Curses! Sonarr is needed for this command.", "error")
  }

  // Validate the message
  const parsed = await validateMonitorCommand(message, settings)
  if (typeof parsed === "string") return parsed

  const { searchString, year, newMonitor } = parsed

  // Find the user tied to the author
  const user = matchedUser(settings, message.author.username)
  if (!user) return `A Discord user by ${message.author.username} does not exist in the database.`

  // Search for the series
  const foundSeriesArr = await searchSonarr(settings, searchString)
  if (!foundSeriesArr || foundSeriesArr.length === 0) {
    return randomNotFoundMessage()
  }

  const sortedSeriesArr = sortTMDBSearchArray<Series>(foundSeriesArr, year)
  const foundSeries = sortedSeriesArr[0]

  // Get series library
  const seriesLibrary = data.libraries.find((API) => API.name === "Sonarr")?.data as
    | Series[]
    | undefined
  if (!seriesLibrary) return "There is no series data in the database... this is bad."

  // Find series in database
  const seriesInDB = seriesLibrary.find(
    (s) =>
      s.tvdbId === foundSeries.tvdbId ||
      (s.tmdbId && s.tmdbId === foundSeries.tmdbId) ||
      (s.imdbId && s.imdbId === foundSeries.imdbId),
  )

  if (!seriesInDB) {
    // Provide helpful suggestions of series in the library that match the search term
    const searchTermLower = searchString.toLowerCase()
    const suggestions = seriesLibrary
      .filter((s) => s.title.toLowerCase().includes(searchTermLower))
      .slice(0, 5)

    const suggestionText =
      suggestions.length > 0
        ? `\n\n**Did you mean any of these?**\n${suggestions
            .map((s) => `" ${s.title} ${s.year}`)
            .join("\n")}`
        : ""

    return discordReply(
      `${foundSeries.title} (${foundSeries.year}) is not in the library. Use !download to add it first.${suggestionText}`,
      "error",
    )
  }

  // Monitor hierarchy for determining upgrade/downgrade
  const monitorHierarchy: Record<string, number> = {
    all: 100,
    recent: 80,
    missing: 70,
    existing: 60,
    future: 50,
    firstSeason: 40,
    lastSeason: 30,
    pilot: 20,
    none: 0,
    monitorSpecials: -1,
    unmonitorSpecials: -1,
  }

  const isUpgrade = (currentMonitor: string, targetMonitor: string): boolean => {
    return monitorHierarchy[targetMonitor] > monitorHierarchy[currentMonitor]
  }

  // Check free disk space before making monitoring changes
  const rootFolder = findRootFolder(data, "Sonarr")
  if (typeof rootFolder === "string") {
    return discordReply(rootFolder, "error")
  }

  const freeSpaceErr = freeSpaceCheck(rootFolder.freeSpace, settings.general_bot.min_free_space)
  if (freeSpaceErr) return discordReply(freeSpaceErr, "error")

  // Handle special monitoring options that don't affect user pools or database
  if (newMonitor === "monitorSpecials" || newMonitor === "unmonitorSpecials") {
    // Update series monitoring in Sonarr
    const updateSuccess = await updateSeriesMonitor(settings, seriesInDB.id, newMonitor)
    if (!updateSuccess) {
      return discordReply("Failed to update monitoring in Sonarr.", "error")
    }

    // If monitoring specials
    if (newMonitor === "monitorSpecials") {
      // trigger a search for the new content
      const searchSuccess = await searchMonitoredSeries(settings, seriesInDB.id)
      if (!searchSuccess) {
        return discordReply(
          `Updated special monitoring for ${seriesInDB.title}, but failed to trigger search. You may need to manually search in Sonarr.`,
          "warn",
        )
      }
      return discordReply(randomMonitorSpecialsMessage(seriesInDB.title), "success")
    }

    // If unmonitoring specials, just return a message
    return discordReply(randomUnmonitorSpecialsMessage(seriesInDB.title), "success")
  }

  // Check if user has series in pool
  const userSeries = user.pool.series.find((s) => seriesMatches(s, seriesInDB))

  // If user doesn't have series in pool, add it
  if (!userSeries) {
    // Check user series pool limit
    const { limitError } = checkUserSeriesLimit(user, settings)
    if (limitError) return discordReply(limitError, "info")

    // Determine if this would be an upgrade or downgrade from current Sonarr state
    const currentMonitor = seriesInDB.monitor || "all"
    const wouldBeUpgrade = isUpgrade(currentMonitor, newMonitor)

    // If downgrading, check restrictions
    if (!wouldBeUpgrade) {
      // Check if any other users have this series
      const { usersWithSeries } = checkUserExclusivity(seriesInDB, settings)

      if (usersWithSeries.length > 0) {
        return discordReply(
          `Cannot downgrade monitoring for ${seriesInDB.title}. ${
            usersWithSeries.length
          } other users have this series: ${usersWithSeries.join(
            ", ",
          )}.\n\nDowngrading requires you to be the only user with this series.`,
          "error",
        )
      }

      // Check if series is in import list
      if (checkSeriesInImportList(seriesInDB, data)) {
        return discordReply(
          `Cannot downgrade monitoring for ${seriesInDB.title}. This series is in an import list.\n\nOnly series not in import lists can be downgraded.`,
          "error",
        )
      }
    }

    // Add to user pool with requested monitor
    settings.general_bot.users = settings.general_bot.users.map((u) => {
      if (u._id === user._id) {
        return {
          ...u,
          pool: {
            ...u.pool,
            series: [...u.pool.series, { ...seriesInDB, monitor: newMonitor }],
          },
        }
      }
      return u
    })

    // Update series monitoring in Sonarr (only if upgrading or downgrade restrictions passed)
    const updateSuccess = await updateSeriesMonitor(settings, seriesInDB.id, newMonitor)
    if (!updateSuccess) {
      return discordReply("Failed to update monitoring in Sonarr.", "error")
    }

    // Wait for Sonarr to process the change
    await new Promise((resolve) => setTimeout(resolve, 5000))

    // Get fresh series data from Sonarr to update season monitored status
    const freshSeries = await getSonarrSeries(settings, seriesInDB.id)
    if (!freshSeries) {
      return discordReply("Failed to retrieve updated series data from Sonarr.", "error")
    }

    // Validate fresh series has season data
    if (!freshSeries.seasons || freshSeries.seasons.length === 0) {
      return discordReply(
        "Series data from Sonarr is missing season information. Cannot update monitoring.",
        "error",
      )
    }

    // Update data.libraries with fresh data including season monitoring
    const sonarrLibrary = data.libraries.find((lib) => lib.name === "Sonarr")
    if (sonarrLibrary) {
      const librarySeriesIndex = (sonarrLibrary.data as Series[]).findIndex(
        (s) =>
          s.tvdbId === seriesInDB.tvdbId ||
          (s.tmdbId && s.tmdbId === seriesInDB.tmdbId) ||
          (s.imdbId && s.imdbId === seriesInDB.imdbId),
      )
      if (librarySeriesIndex !== -1) {
        const existingSeries = (sonarrLibrary.data as Series[])[librarySeriesIndex]
        // Update monitor field
        existingSeries.monitor = newMonitor
        // Update only the monitored boolean in each season, preserving Automatarr metadata
        existingSeries.seasons = existingSeries.seasons.map((existingSeason) => {
          const freshSeason = freshSeries.seasons.find(
            (s) => s.seasonNumber === existingSeason.seasonNumber,
          )
          return freshSeason
            ? { ...existingSeason, monitored: freshSeason.monitored }
            : existingSeason
        })
      }
    }

    // Save data object (non-critical - will sync with getData later)
    if (!(await saveWithRetry(data, "caseMonitor - update libraries"))) {
      // Log but continue - this will be fixed by next getData sync
      console.warn(
        `Failed to save data.libraries after monitor change for ${seriesInDB.title}, but continuing`,
      )
    }

    // Only trigger search if we're upgrading (adding monitored content)
    if (wouldBeUpgrade) {
      const searchSuccess = await searchMonitoredSeries(settings, seriesInDB.id)
      if (!searchSuccess) {
        return discordReply(
          `Added ${seriesInDB.title} to your pool with "${newMonitor}" monitoring, but failed to trigger search. You may need to manually search in Sonarr.`,
          "warn",
        )
      }
    }

    // Save settings to database (CRITICAL - user pool changes)
    if (!(await saveWithRetry(settings, "caseMonitor - add to pool"))) {
      return discordReply(
        `CRITICAL: Failed to save ${seriesInDB.title} to your pool. The series was updated in Sonarr but not added to your user pool. Please contact the server owner.`,
        "error",
      )
    }

    return discordReply(
      randomMonitorAddedToPoolMessage(seriesInDB.title, newMonitor),
      "success",
      `${user.name} | Added ${seriesInDB.title} to pool with ${newMonitor} monitoring.`,
    )
  }

  // User has series in pool - update monitoring
  const currentMonitor = userSeries.monitor || "all"

  // Check if already set to this monitor
  if (currentMonitor === newMonitor) {
    return discordReply(
      `${seriesInDB.title} is already set to monitor "${newMonitor}". No changes needed!`,
      "info",
    )
  }

  const upgrading = isUpgrade(currentMonitor, newMonitor)

  // If downgrading, check restrictions
  if (!upgrading) {
    // Check if user is the only one with this series
    const { isExclusive, usersWithSeries } = checkUserExclusivity(seriesInDB, settings)

    if (!isExclusive) {
      return discordReply(
        `Cannot downgrade monitoring for ${seriesInDB.title}. ${
          usersWithSeries.length
        } users have this series: ${usersWithSeries.join(
          ", ",
        )}.\n\nDowngrading requires you to be the only user with this series.`,
        "error",
      )
    }

    // Check if series is in import list
    if (checkSeriesInImportList(seriesInDB, data)) {
      return discordReply(
        `Cannot downgrade monitoring for ${seriesInDB.title}. This series is in an import list.\n\nOnly series not in import lists can be downgraded.`,
        "error",
      )
    }
  }

  // Update series monitoring in Sonarr
  const updateSuccess = await updateSeriesMonitor(settings, seriesInDB.id, newMonitor)
  if (!updateSuccess) {
    return discordReply("Failed to update monitoring in Sonarr.", "error")
  }

  // Wait for Sonarr to process the change
  await new Promise((resolve) => setTimeout(resolve, 5000))

  // Get fresh series data from Sonarr to update season monitored status
  const freshSeries = await getSonarrSeries(settings, seriesInDB.id)
  if (!freshSeries) {
    return discordReply("Failed to retrieve updated series data from Sonarr.", "error")
  }

  // Validate fresh series has season data
  if (!freshSeries.seasons || freshSeries.seasons.length === 0) {
    return discordReply(
      "Series data from Sonarr is missing season information. Cannot update monitoring.",
      "error",
    )
  }

  // Update data.libraries with fresh data including season monitoring
  const sonarrLibrary = data.libraries.find((lib) => lib.name === "Sonarr")
  if (sonarrLibrary) {
    const librarySeriesIndex = (sonarrLibrary.data as Series[]).findIndex(
      (s) =>
        s.tvdbId === seriesInDB.tvdbId ||
        (s.tmdbId && s.tmdbId === seriesInDB.tmdbId) ||
        (s.imdbId && s.imdbId === seriesInDB.imdbId),
    )
    if (librarySeriesIndex !== -1) {
      const existingSeries = (sonarrLibrary.data as Series[])[librarySeriesIndex]
      // Update monitor field
      existingSeries.monitor = newMonitor
      // Update only the monitored boolean in each season, preserving Automatarr metadata
      existingSeries.seasons = existingSeries.seasons.map((existingSeason) => {
        const freshSeason = freshSeries.seasons.find(
          (s) => s.seasonNumber === existingSeason.seasonNumber,
        )
        return freshSeason
          ? { ...existingSeason, monitored: freshSeason.monitored }
          : existingSeason
      })
    }
  }

  // Save data object (non-critical - will sync with getData later)
  if (!(await saveWithRetry(data, "caseMonitor - update libraries"))) {
    // Log but continue - this will be fixed by next getData sync
    console.warn(
      `Failed to save data.libraries after monitor change for ${seriesInDB.title}, but continuing`,
    )
  }

  // Only trigger search if upgrading (adding monitored content)
  if (upgrading) {
    const searchSuccess = await searchMonitoredSeries(settings, seriesInDB.id)
    if (!searchSuccess) {
      return discordReply(
        `Updated ${seriesInDB.title} monitoring to "${newMonitor}", but failed to trigger search. You may need to manually search in Sonarr.`,
        "warn",
      )
    }
  }

  // Update user pool
  settings.general_bot.users = settings.general_bot.users.map((u) => {
    if (u._id === user._id) {
      return {
        ...u,
        pool: {
          ...u.pool,
          series: u.pool.series.map((s) =>
            seriesMatches(s, seriesInDB) ? { ...s, monitor: newMonitor } : s,
          ),
        },
      }
    }
    return u
  })

  // Save to database (CRITICAL - user pool changes)
  if (!(await saveWithRetry(settings, "caseMonitor - update monitor"))) {
    return discordReply(
      `CRITICAL: Failed to save monitoring change for ${seriesInDB.title}. The series was updated in Sonarr but your user pool was not updated. Please contact the server owner.`,
      "error",
    )
  }

  // Return appropriate message
  const messageFunc = upgrading ? randomMonitorUpgradeMessage : randomMonitorDowngradeMessage
  return discordReply(
    messageFunc(seriesInDB.title, currentMonitor, newMonitor),
    "success",
    `${user.name} | Changed ${seriesInDB.title} monitoring from ${currentMonitor} to ${newMonitor}.`,
  )
}
