import logger from "../logger"
import { Episode } from "../types/episodeTypes"
import { Movie } from "../types/movieTypes"
import { Torrent } from "../types/qBittorrentTypes"
import { Series } from "../types/seriesTypes"
import { isEpisode, isMovie } from "../types/typeGuards"
import { APIData } from "./activeAPIsArr"
import { extractStringWords, secsToMins } from "./utility"

// Check if a torrent has exceeded its seeding requirements
export const torrentSeedCheck = (torrent: Torrent, type?: string): boolean => {
  const { ratio, ratio_limit, seeding_time, seeding_time_limit, name } = torrent
  const seeding_time_mins = Number(secsToMins(seeding_time).toFixed(0))

  const exceededRatio = ratio > ratio_limit
  const exceededTime = seeding_time_mins > seeding_time_limit

  if (exceededRatio && exceededTime) {
    return true
  }

  const prefix = type ? `${type} torrent` : `Torrent`
  const ratioInfo = `ratio: ${ratio.toFixed(2)}/${ratio_limit}`
  const timeInfo = `time: ${seeding_time_mins}/${seeding_time_limit} mins`

  logger.info(`${prefix} has not met seeding requirements (${ratioInfo}, ${timeInfo}): ${name}`)

  return false
}

// Check if a torrent has downloaded and is seeding
export const torrentDownloadedCheck = (torrent: Torrent, type?: string): boolean => {
  const { state, name } = torrent

  const prefix = type ? `${type} t` : `T`

  // All status strings that signify the torrent is downloaded
  if (state === "stalledUP" || state === "uploading" || state === "pausedUP") {
    return true
  }

  if (state === "downloading") {
    logger.info(`Torrent is downloading: ${name}`)
  }

  if (state === "stalledDL") {
    logger.warn(`${prefix}orrent has stalled: ${name}`)
  }

  if (state === "unknown") {
    logger.warn(`${prefix}orrent has an unknown status: ${name}`)
  }

  if (state === "error") {
    logger.warn(`${prefix}orrent has an error: ${name}`)
  }

  if (state === "missingFiles") {
    logger.warn(`${prefix}orrent has missing files: ${name}`)
  }

  return false
}

// Get Season and Episode data from a string
export const extractSeasonEpisode = (input: string): { season: number; episode: number } | null => {
  const lower = input.toLowerCase()

  // Try format: s12e3 or s3e02
  const seMatch = lower.match(/s(\d{1,2})e(\d{1,2})/)
  if (seMatch) {
    return { season: parseInt(seMatch[1], 10), episode: parseInt(seMatch[2], 10) }
  }

  // Try format: season 1 episode 3 or season12 episode34
  const verboseMatch = lower.match(/season[\s]?(\d{1,2})[\s_-]*episode[\s]?(\d{1,2})/)
  if (verboseMatch) {
    return { season: parseInt(verboseMatch[1], 10), episode: parseInt(verboseMatch[2], 10) }
  }

  return null
}

// Check if sourceString has the same Season and Episode data as matchString
const matchSeasonEpisode = (sourceString: string, matchString: string): boolean => {
  const info = extractSeasonEpisode(sourceString)
  if (!info) return false

  const { season, episode } = info

  // Pad season and episode to 2 digits
  const pad = (num: number) => num.toString().padStart(2, "0")
  const paddedSeason = pad(season)
  const paddedEpisode = pad(episode)

  // Build regexes to match various formats with strict boundaries
  const patterns = [
    new RegExp(`s${paddedSeason}e${paddedEpisode}\\b`, "i"), // s04e01
    new RegExp(`season[\\s._-]*${season}\\D+episode[\\s._-]*${episode}\\b`, "i"), // season 4 episode 1
  ]

  return patterns.some((pattern) => pattern.test(matchString))
}

// Get Season and Episode data from a string
const extractSeason = (input: string): number | null => {
  const lower = input.toLowerCase()

  // Match s07, s7, etc.
  const sMatch = lower.match(/s(\d{1,2})\b/)
  if (sMatch) return parseInt(sMatch[1], 10)

  // Match season 7, season07, etc.
  const verboseMatch = lower.match(/season[\s_-]?(\d{1,2})\b/)
  if (verboseMatch) return parseInt(verboseMatch[1], 10)

  return null
}

// Check if sourceString only has the same Season data as matchString
const matchSeasonOnly = (sourceString: string, matchString: string): boolean => {
  const season = extractSeason(sourceString)
  if (season === null) return false

  const lower = matchString.toLowerCase()

  // Check for episode patterns — if any episode pattern exists, bail out
  const episodePattern = /\bs?\d{1,2}e\d{1,2}\b|episode\s?\d{1,2}\b|e\d{1,2}[-e\d]*\b/
  if (episodePattern.test(lower)) {
    return false
  }

  // Season match patterns
  const seasonPatterns = [
    new RegExp(`s0?${season}\\b`), // s7 or s07
    new RegExp(`season[\\s_-]*0?${season}\\b`), // season 7, season-7
  ]

  return seasonPatterns.some((pattern) => pattern.test(lower))
}

// Sort an array of Episodes for a specific Series and Season by episodeNumber
const getEpisodesForSeason = (
  allEpisodes: Episode[],
  seriesId: number,
  seasonNumber: number,
): Episode[] => {
  return allEpisodes
    .filter((ep) => ep.seriesId === seriesId && ep.seasonNumber === seasonNumber)
    .sort((a, b) => a.episodeNumber - b.episodeNumber)
}

// Add Episode and Torrent data to Season fields in an array of Series
const updatedSeriesItems = (seriesArr: Series[], episodes: Episode[]): Series[] => {
  const updatedSeries = seriesArr.map((series) => {
    return {
      ...series,
      seasons: series.seasons.map((season) => {
        const episodesForSeason = getEpisodesForSeason(episodes, series.id, season.seasonNumber)

        return {
          ...season,
          torrentsPresent: episodesForSeason.some((ep) => ep.torrent),
          seasonTorrent: episodesForSeason.find((e) => e.torrentType === "Series")?.torrentFile,
          episodes: episodesForSeason,
        }
      }),
    }
  })

  return updatedSeries.map((series) => {
    return {
      ...series,
      torrentsPresent: series.seasons.some((ep) => ep.torrentsPresent),
    }
  })
}

// Takes in Starr app library items and compares them to torrents in qBittorrent.
// For every library item that has a matching torrent, add and populate torrent fields.
// Return all library items that have a matching torrent with new torrent data.
export const findLibraryTorrents = (
  activeAPIs: APIData[],
  torrents: Torrent[],
): {
  updatedActiveAPIs: APIData[] // Updated activeAPIs with torrent data included
  unmatchedTorrents: Torrent[] // Array of torrents that could not be matched to a library item
} => {
  // An Array of Movies from Radarr
  const movieItems: Movie[] = activeAPIs
    .filter((API) => API.name === "Radarr")
    .flatMap((API) => API.data.library as Movie[])

  // An Array of Episodes from Sonarr
  const episodeItems: Episode[] = activeAPIs
    .filter((API) => API.name === "Sonarr")
    .flatMap((API) => API.data.episodes as Episode[])

  // An Array of Movies and Episodes so we can easily loop through the files and find torrents
  const moviesAndEpisodes: (Movie | Episode)[] = [...movieItems, ...episodeItems]

  // An Array of Movies with torrent data
  const updatedMovieItems: Movie[] = []

  // An Array of Episodes with torrent data
  const updatedEpisodeItems: Episode[] = []

  // Loop through starr app libraries
  for (const item of moviesAndEpisodes) {
    // If a movie or episode file exists. I.E if a file is attached to the library item.
    if (item.hasFile) {
      const relativePath = isMovie(item)
        ? item.movieFile.relativePath
        : item.episodeFile.relativePath
      const resolution = isMovie(item)
        ? item.movieFile.quality.quality.resolution
        : item.episodeFile.quality.quality.resolution
      const releaseGroup = isMovie(item)
        ? item.movieFile.releaseGroup
        : item.episodeFile.releaseGroup
      // Return the torrent type as well
      let torrentType: "Movie" | "Episode" | "Series" = "Movie"
      // Create an array of strings to find a torrent object with
      const matchStrings = extractStringWords(relativePath).map((str) => str.toLowerCase())
      // Add resolution to the array
      resolution && matchStrings.push(resolution.toString().toLowerCase())
      // Add release group to the array
      releaseGroup && matchStrings.push(releaseGroup.toLowerCase())
      // For each library item, find a matching torrent using the matchStrings
      const torrentMatches = torrents.filter((torrent) => {
        // Check if every string in matchStrings can be found in any torrent name
        const stringsMatch = matchStrings.every((str) => torrent.processedName.includes(str))
        // The secondary match criteria. Year for Radarr and S**E** for Sonarr
        let secondaryMatch = false

        if (isMovie(item)) {
          // If a seconday year can be found for a file, use it
          const secondaryYear = item.secondaryYear
            ? item.secondaryYear.toString()
            : "No Secondary Year"
          // Check if either year or secondaryYear matches the year in the torrent name
          secondaryMatch =
            torrent.name.includes(item.year.toString()) || torrent.name.includes(secondaryYear)
        }

        if (isEpisode(item)) {
          // Check if Season and Episode data matches any torrent
          const episodeMatchExists = torrents.some((t) =>
            matchSeasonEpisode(relativePath, t.processedName),
          )

          // If we know a torrent that matches by Season and Episode exists, check if it's this torrent.
          if (episodeMatchExists) {
            secondaryMatch = matchSeasonEpisode(relativePath, torrent.processedName)
            torrentType = "Episode"
          } else {
            // If there is no episode match, check if a torrent for the whole Season exists
            secondaryMatch = matchSeasonOnly(relativePath, torrent.processedName)
            torrentType = "Series"
          }
        }

        // If stringsMatch and yearsMatch is truthy then return this torrent
        return stringsMatch && secondaryMatch
      })

      let torrentMatch = null

      // If there's exactly one matching torrent, use it
      if (torrentMatches.length === 1) {
        torrentMatch = torrentMatches[0]
      }

      // If there are two or more matching torrents, pick the most recently added one
      if (torrentMatches.length > 1) {
        torrentMatch = torrentMatches.reduce((latest, current) =>
          current.added_on > latest.added_on ? current : latest,
        )
      }

      // If there is a match, push it to the matches array
      if (torrentMatch) {
        const updatedItem = {
          ...item,
          torrent: true,
          torrentType,
          torrentFile: {
            ...torrentMatch,
            torrentType,
            matchStrings,
          },
        }

        if (isMovie(item)) {
          updatedMovieItems.push(updatedItem as Movie)
        } else if (isEpisode(item)) {
          updatedEpisodeItems.push(updatedItem as Episode)
        }
      }
    }
  }

  // An Array of updated Movies and Episodes so we can easily find matched torrents
  const updatedMoviesAndEpisodes: (Movie | Episode)[] = [
    ...updatedMovieItems,
    ...updatedEpisodeItems,
  ]

  // Init an array for all torrents that haven't been matched to a library item
  const unmatchedTorrents: Torrent[] = []

  // If torrent not matched to a library item, add it to the unmatchedTorrents array.
  // Likely this is due to a Starr app "upgrade" leading to two or more downloads of the same film or episode.
  for (const torrent of torrents) {
    const unmatchedTorrent = !updatedMoviesAndEpisodes.some(
      (item) => item.torrentFile?.name === torrent.name,
    )

    if (unmatchedTorrent) {
      unmatchedTorrents.push(torrent)
    }
  }

  const updatedActiveAPIs = activeAPIs.map((API) => {
    if (API.name === "Radarr") {
      return {
        ...API,
        data: {
          ...API.data,
          library: API.data.library
            ? API.data.library.map(
                (item) => updatedMovieItems.find((i) => i.id === item.id) || item,
              )
            : API.data.library,
        },
      }
    } else if (API.name === "Sonarr") {
      const episodeItemsUpdated = API.data.episodes
        ? API.data.episodes.map((item) => updatedEpisodeItems.find((i) => i.id === item.id) || item)
        : API.data.episodes

      return {
        ...API,
        data: {
          ...API.data,
          library: API.data.library
            ? updatedSeriesItems(API.data.library as Series[], episodeItemsUpdated as Episode[])
            : API.data.library,
          episodes: episodeItemsUpdated,
        },
      }
    } else {
      return API
    }
  })

  return {
    updatedActiveAPIs,
    unmatchedTorrents,
  }
}
