import fs from "fs"
import path from "path"
import logger from "../logger"
import { settingsType } from "../models/settings"
import { isDocker, deleteFromMachine } from "../shared/fileSystem"
import { updateLoopData } from "./loopUtility"
import { checkPermissions } from "../shared/permissions"
import Data, { dataType } from "../models/data"

const storage_cleaner = async (_settings: settingsType, passedData?: dataType): Promise<void> => {
  if (process.env.NODE_ENV === "development") {
    logger.info("storage_cleaner bypassed. In Development mode. 🔧")
    return
  }

  try {
    // Use passed data if available (ensures fresh data), otherwise fetch from database
    const data = passedData || await Data.findOne()

    if (!data) {
      logger.error("storage_cleaner: No data object found in database.")
      return
    }

    // Update loop tracking data
    updateLoopData("storage_cleaner" as keyof typeof data.loops, data)

    logger.info("storage_cleaner: Starting storage cleanup scan...")

    // Get active root directories from both Radarr and Sonarr
    const activeRootFolders = data.rootFolders.filter(
      (folder) => folder.name === "Radarr" || folder.name === "Sonarr",
    )

    if (activeRootFolders.length === 0) {
      logger.warn("storage_cleaner: No active Radarr or Sonarr root folders found.")
      return
    }

    // Check permissions for all root directories before proceeding
    const permissionsValid = activeRootFolders.every((folder) => {
      const hasPermissions = checkPermissions(
        folder.data.path,
        ["read", "delete"],
        folder.name,
      )
      if (!hasPermissions) {
        logger.error(
          `storage_cleaner: Insufficient permissions for ${folder.name} root directory: ${folder.data.path}`,
        )
      }
      return hasPermissions
    })

    if (!permissionsValid) {
      logger.error(
        "storage_cleaner: Failed permissions check for one or more root directories. Aborting scan.",
      )
      return
    }

    // Build sets of known directory names from libraries
    const knownMovieDirectories = new Set<string>()
    const knownSeriesDirectories = new Set<string>()

    // Extract movie directory names from libraries
    data.libraries.forEach((library) => {
      if (library.name === "Radarr" && library.data) {
        library.data.forEach((movie: any) => {
          if (movie.path) {
            const dirName = path.basename(movie.path)
            knownMovieDirectories.add(dirName)
          }
        })
      }

      // Extract series directory names from Sonarr library
      if (library.name === "Sonarr" && library.data) {
        // Primary method: Extract from series.path directly (like Radarr movies)
        library.data.forEach((series: any) => {
          if (series.path) {
            const dirName = path.basename(series.path)
            knownSeriesDirectories.add(dirName)
          }
        })

        // Fallback method: Extract from episode file paths for any series that might have been missed
        if (library.episodes) {
          library.episodes.forEach((episode: any) => {
            if (episode.episodeFile?.path) {
              const episodePath = episode.episodeFile.path
              const pathParts = episodePath.split(path.sep)

              // Find the series directory (usually 2-3 levels up from the episode file)
              let seriesDir = ""
              for (let i = pathParts.length - 1; i >= 0; i--) {
                const part = pathParts[i]
                // Look for directory with series pattern (contains year and id in braces)
                if (part.includes("{") && part.includes("}") && part.match(/\(\d{4}\)/)) {
                  seriesDir = part
                  break
                }
              }

              if (seriesDir) {
                knownSeriesDirectories.add(seriesDir)
              }
            }
          })
        }
      }
    })

    logger.info(
      `storage_cleaner: Found ${knownMovieDirectories.size} known movie directories and ${knownSeriesDirectories.size} known series directories in libraries.`,
    )

    // Scan each root directory for orphaned content
    let totalOrphansFound = 0
    let orphanedMovies = 0
    let orphanedSeries = 0
    let deletedMovies = 0
    let deletedSeries = 0
    const scannedApps: string[] = []

    for (const rootFolder of activeRootFolders) {
      const rootPath = rootFolder.data.path
      let actualPath = rootPath

      // Track which apps we're scanning
      if (!scannedApps.includes(rootFolder.name)) {
        scannedApps.push(rootFolder.name)
      }

      // Prepend /host_fs if running in Docker
      if (isDocker) {
        actualPath = path.join("/host_fs", rootPath)
      }

      try {
        // Check if root directory exists
        if (!fs.existsSync(actualPath)) {
          logger.warn(`storage_cleaner: Root directory does not exist: ${actualPath}`)
          continue
        }

        // Read all directories in the root path
        const diskDirectories = fs
          .readdirSync(actualPath, { withFileTypes: true })
          .filter((dirent) => dirent.isDirectory())
          .map((dirent) => dirent.name)

        logger.info(
          `storage_cleaner: Scanning ${diskDirectories.length} directories in ${rootFolder.name} root: ${rootPath}`,
        )

        // Check each directory against known libraries
        for (const diskDir of diskDirectories) {
          const fullPath = path.join(rootPath, diskDir)
          let isOrphaned = false

          if (rootFolder.name === "Radarr") {
            isOrphaned = !knownMovieDirectories.has(diskDir)
          } else if (rootFolder.name === "Sonarr") {
            isOrphaned = !knownSeriesDirectories.has(diskDir)
          }

          if (isOrphaned) {
            logger.warn(`storage_cleaner | Orphaned: ${fullPath}`)
            totalOrphansFound++

            // Track orphan counts
            if (rootFolder.name === "Radarr") {
              orphanedMovies++
            } else if (rootFolder.name === "Sonarr") {
              orphanedSeries++
            }

            // Attempt to delete the orphaned directory
            const deleteSuccess = deleteFromMachine(fullPath)

            if (deleteSuccess) {
              logger.success(`storage_cleaner | Deleted: ${fullPath}`)

              // Track successful deletions
              if (rootFolder.name === "Radarr") {
                deletedMovies++
              } else if (rootFolder.name === "Sonarr") {
                deletedSeries++
              }
            } else {
              logger.error(`storage_cleaner | Failed to delete: ${fullPath}`)
            }
          }
        }
      } catch (err) {
        logger.error(`storage_cleaner: Error scanning root directory ${actualPath}: ${err}`)
      }
    }

    if (totalOrphansFound === 0) {
      logger.info("storage_cleaner: No orphaned directories found. Storage is clean! ✨")
    } else {
      // Build the summary message
      const appsScanned = `[${scannedApps.join(", ")}]`
      const foundResults: string[] = []
      const deletedResults: string[] = []

      // Build found results
      if (orphanedSeries > 0) {
        foundResults.push(`${orphanedSeries} orphaned series`)
      }
      if (orphanedMovies > 0) {
        foundResults.push(`${orphanedMovies} orphaned movies`)
      }

      // Build deleted results
      if (deletedSeries > 0) {
        deletedResults.push(`${deletedSeries} series`)
      }
      if (deletedMovies > 0) {
        deletedResults.push(`${deletedMovies} movies`)
      }

      const foundMessage = `Found ${foundResults.join(", ")}`
      const deletedMessage =
        deletedResults.length > 0 ? ` Deleted ${deletedResults.join(", ")}` : " No items deleted"

      logger.info(
        `storage_cleaner: Scan complete. ${appsScanned} ${foundMessage}.${deletedMessage}.`,
      )
    }

    // Save updated loop data
    // await data.save()
  } catch (err) {
    logger.error(`storage_cleaner: Unexpected error: ${err}`)
  }
}

export default storage_cleaner
