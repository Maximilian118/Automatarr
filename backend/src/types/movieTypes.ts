import { Torrent } from "./qBittorrentTypes"
import { Language, Quality } from "./types"

type AlternateTitle = {
  sourceType: string
  movieMetadataId: number
  title: string
  id: number
}

type Image = {
  coverType: string
  url: string
  remoteUrl: string
}

type Rating = {
  votes: number
  value: number
  type: string
}

type Ratings = {
  imdb?: Rating
  tmdb?: Rating
  metacritic?: Rating
  rottenTomatoes?: Rating
  trakt?: Rating
}

type MediaInfo = {
  audioBitrate: number
  audioChannels: number
  audioCodec: string
  audioLanguages: string
  audioStreamCount: number
  videoBitDepth: number
  videoBitrate: number
  videoCodec: string
  videoFps: number
  videoDynamicRange: string
  videoDynamicRangeType: string
  resolution: string
  runTime: string
  scanType: string
  subtitles: string
}

type MovieFile = {
  movieId: number
  relativePath: string
  path: string
  size: number
  dateAdded: string
  sceneName: string
  releaseGroup: string
  edition: string
  languages: Array<{ [key: string]: any }>
  quality: Quality
  customFormatScore: number
  indexerFlags: number
  mediaInfo: MediaInfo
  originalFilePath: string
  qualityCutoffNotMet: boolean
  id: number
}

type Collection = {
  title: string
  tmdbId: number
}

type Statistics = {
  movieFileCount: number
  sizeOnDisk: number
  releaseGroups: string[]
}

export type Movie = {
  title: string
  originalTitle: string
  originalLanguage: Language
  alternateTitles: AlternateTitle[]
  secondaryYear?: number
  secondaryYearSourceId: number
  sortTitle: string
  sizeOnDisk: number
  status: "inCinemas" | "released" | "announced"
  overview: string
  inCinemas: string
  physicalRelease: string
  digitalRelease: string
  releaseDate: string
  images: Image[]
  website: string
  year: number
  youTubeTrailerId: string
  studio: string
  path: string
  qualityProfileId: number
  hasFile: boolean
  movieFileId: number
  monitored: boolean
  minimumAvailability: string
  isAvailable: boolean
  folderName: string
  runtime: number
  cleanTitle: string
  imdbId: string
  tmdbId: number
  titleSlug: string
  rootFolderPath: string
  certification: string
  genres: string[]
  tags: number[]
  added: string
  ratings: Ratings
  movieFile: MovieFile
  collection: Collection
  popularity: number
  lastSearchTime: string
  statistics: Statistics
  torrent: boolean
  torrentType?: "Movie" | "Episode" | "Series"
  torrentFile?: Torrent
  id: number
}
