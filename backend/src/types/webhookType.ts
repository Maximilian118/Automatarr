import { EventType } from "../models/webhook"

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
