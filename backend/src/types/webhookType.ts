import { EventType } from "../models/webhook"
import { APIData } from "../shared/activeAPIsArr"

type Language = {
  id: number
  name: string
}

type MediaInfo = {
  audioChannels: number
  audioCodec: string
  audioLanguages: string[]
  height: number
  width: number
  subtitles: string[]
  videoCodec: string
  videoDynamicRange: string
  videoDynamicRangeType: string
}

type Movie = {
  id: number
  title: string
  year: number
  releaseDate: string
  folderPath: string
  tmdbId: number
  imdbId: string
  overview: string
  genres: string[]
  images: any[]
  tags: any[]
  originalLanguage: Language
}

type RemoteMovie = {
  tmdbId: number
  imdbId: string
  title: string
  year: number
}

type MovieFile = {
  id: number
  relativePath: string
  path: string
  quality: string
  qualityVersion: number
  releaseGroup: string
  sceneName: string
  indexerFlags: string
  size: number
  dateAdded: string
  languages: any[]
  mediaInfo: MediaInfo
  sourcePath: string
}

type Series = {
  id: number
  title: string
  titleSlug: string
  path: string
  tvdbId: number
  tvMazeId: number
  tmdbId: number
  imdbId: string
  type: string
  year: number
  genres: string[]
  images: any[]
  tags: any[]
  originalLanguage: Language
}

type Episode = {
  id: number
  episodeNumber: number
  seasonNumber: number
  title: string
  overview: string
  airDate: string
  airDateUtc: string
  seriesId: number
  tvdbId: number
}

type Release = {
  releaseTitle: string
  indexer: string
  size: number
  releaseType?: string
  indexerFlags?: any[]
}

type CustomFormatInfo = {
  customFormats: any[]
  customFormatScore: number
}

export type StarrWebhookType = {
  eventType: EventType
  instanceName: "Radarr" | "Sonarr" | "Lidarr"
  applicationUrl: string
  isUpgrade: boolean
  downloadClient: string
  downloadClientType: string
  downloadId: string

  // Optional Radarr
  movie?: Movie
  remoteMovie?: RemoteMovie
  movieFile?: MovieFile

  // Optional Sonarr
  series?: Series
  episodes?: Episode[]
  episodeFile?: MovieFile
  episodeFiles?: MovieFile[]

  // Shared/optional
  release?: Release
  deletedFiles?: MovieFile[]
  customFormatInfo?: CustomFormatInfo
  fileCount?: number
  sourcePath?: string
  destinationPath?: string
}

export type StarrWebhookResponseType = {
  configContract: "WebhookSettings"
  fields: [
    { name: "url"; value: string },
    { name: "method"; value: 1 },
    { name: "username" },
    { name: "password" },
    { name: "headers"; value: [] },
  ]
  implementation: "Webhook"
  implementationName: "Webhook"
  includeHealthWarnings: boolean
  infoLink: string
  name: string

  // Shared Event Toggles
  onApplicationUpdate: boolean
  onDownload: boolean
  onGrab: boolean
  onHealthIssue: boolean
  onHealthRestored: boolean
  onManualInteractionRequired: boolean
  onRename: boolean
  onUpgrade: boolean

  // Radarr-specific
  onMovieAdded?: boolean
  onMovieDelete?: boolean
  onMovieFileDelete?: boolean
  onMovieFileDeleteForUpgrade?: boolean

  // Sonarr-specific
  onImportComplete?: boolean
  onSeriesAdd?: boolean
  onSeriesDelete?: boolean
  onEpisodeFileDelete?: boolean
  onEpisodeFileDeleteForUpgrade?: boolean

  // Supported flags (optional, returned in GET responses)
  supportsOnApplicationUpdate?: boolean
  supportsOnDownload?: boolean
  supportsOnGrab?: boolean
  supportsOnHealthIssue?: boolean
  supportsOnHealthRestored?: boolean
  supportsOnManualInteractionRequired?: boolean
  supportsOnRename?: boolean
  supportsOnUpgrade?: boolean

  supportsOnMovieAdded?: boolean
  supportsOnMovieDelete?: boolean
  supportsOnMovieFileDelete?: boolean
  supportsOnMovieFileDeleteForUpgrade?: boolean

  supportsOnImportComplete?: boolean
  supportsOnSeriesAdd?: boolean
  supportsOnSeriesDelete?: boolean
  supportsOnEpisodeFileDelete?: boolean
  supportsOnEpisodeFileDeleteForUpgrade?: boolean

  tags: string[]
}

export const initWebhookBody = (API: APIData, webhookURL: string): StarrWebhookResponseType => {
  return {
    configContract: "WebhookSettings",
    fields: [
      { name: "url", value: webhookURL },
      { name: "method", value: 1 },
      { name: "username" },
      { name: "password" },
      { name: "headers", value: [] },
    ],
    implementation: "Webhook",
    implementationName: "Webhook",
    includeHealthWarnings: false,
    infoLink: `https://wiki.servarr.com/${API.name.toLowerCase()}/supported#webhook`,
    name: "Automatarr",

    // Shared
    onApplicationUpdate: true,
    onDownload: true,
    onGrab: true,
    onHealthIssue: false,
    onHealthRestored: false,
    onManualInteractionRequired: true,
    onRename: true,
    onUpgrade: true,

    // Radarr
    onMovieAdded: true,
    onMovieDelete: true,
    onMovieFileDelete: true,
    onMovieFileDeleteForUpgrade: true,

    // Sonarr
    onImportComplete: true,
    onSeriesAdd: true,
    onSeriesDelete: true,
    onEpisodeFileDelete: true,
    onEpisodeFileDeleteForUpgrade: true,

    // Supported flags (not required for POST, but allowed)
    supportsOnApplicationUpdate: true,
    supportsOnDownload: true,
    supportsOnGrab: true,
    supportsOnHealthIssue: true,
    supportsOnHealthRestored: true,
    supportsOnManualInteractionRequired: true,
    supportsOnRename: true,
    supportsOnUpgrade: true,

    supportsOnMovieAdded: true,
    supportsOnMovieDelete: true,
    supportsOnMovieFileDelete: true,
    supportsOnMovieFileDeleteForUpgrade: true,

    supportsOnImportComplete: true,
    supportsOnSeriesAdd: true,
    supportsOnSeriesDelete: true,
    supportsOnEpisodeFileDelete: true,
    supportsOnEpisodeFileDeleteForUpgrade: true,

    tags: [],
  }
}
