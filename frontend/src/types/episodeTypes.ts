import { Series, SeriesImage } from "./seriesTypes"
import { Language, Quality } from "./types"

type SelectOption = {
  value: number
  name: string
  order: number
  hint: string
}

type Field = {
  order: number
  name: string
  label: string
  unit: string
  helpText: string
  helpTextWarning: string
  helpLink: string
  value: string
  type: string
  advanced: boolean
  selectOptions: SelectOption[]
  selectOptionsProviderAction: string
  section: string
  hidden: string
  privacy: string
  placeholder: string
  isFloat: boolean
}

type Specification = {
  id: number
  name: string
  implementation: string
  implementationName: string
  infoLink: string
  negate: boolean
  required: boolean
  fields: Field[]
  presets: string[]
}

type CustomFormat = {
  id: number
  name: string
  includeCustomFormatWhenRenaming: boolean
  specifications: Specification[]
}

type MediaInfo = {
  id: number
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

type EpisodeFile = {
  id: number
  seriesId: number
  seasonNumber: number
  relativePath: string
  path: string
  size: number
  dateAdded: Date
  sceneName: string
  releaseGroup: string
  languages: Language[]
  quality: Quality
  customFormats: CustomFormat[]
  customFormatScore: number
  indexerFlags: number
  releaseType: string
  mediaInfo: MediaInfo
  qualityCutoffNotMet: boolean
}

export type Episode = {
  id: number
  seriesId: number
  tvdbId: number
  episodeFileId: number
  seasonNumber: number
  episodeNumber: number
  title: string
  airDate: string
  airDateUtc: Date
  lastSearchTime: Date
  runtime: number
  finaleType: string
  overview: string
  episodeFile: EpisodeFile
  hasFile: boolean
  monitored: boolean
  absoluteEpisodeNumber: number
  sceneAbsoluteEpisodeNumber: number
  sceneEpisodeNumber: number
  sceneSeasonNumber: number
  unverifiedSceneNumbering: boolean
  endTime: Date
  grabDate: Date
  series: Series
  images: SeriesImage[]
}
