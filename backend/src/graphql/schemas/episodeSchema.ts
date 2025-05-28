const episodeSchema = `
  type EpisodeFile {
    id: Int!
    seriesId: Int!
    seasonNumber: Int!
    relativePath: String!
    path: String!
    size: Float!
    dateAdded: String!
    sceneName: String!
    releaseGroup: String!
    languages: [EpisodeLanguage!]!
    quality: EpisodeQuality!
    customFormats: [CustomFormat!]!
    customFormatScore: Int!
    indexerFlags: Int!
    releaseType: String!
    mediaInfo: EpisodeMediaInfo!
    qualityCutoffNotMet: Boolean!
  }

  type EpisodeMediaInfo {
    id: Int!
    audioBitrate: Int!
    audioChannels: Int!
    audioCodec: String!
    audioLanguages: String!
    audioStreamCount: Int!
    videoBitDepth: Int!
    videoBitrate: Int!
    videoCodec: String!
    videoFps: Float!
    videoDynamicRange: String!
    videoDynamicRangeType: String!
    resolution: String!
    runTime: String!
    scanType: String!
    subtitles: String!
  }

  type EpisodeLanguage {
    id: Int!
    name: String!
  }

  type EpisodeQuality {
    quality: EpisodeBasicQuality!
    revision: EpisodeQualityRevision!
  }

  type EpisodeBasicQuality {
    id: Int!
    name: String!
    source: String!
    resolution: Int!
  }

  type EpisodeQualityRevision {
    version: Int!
    real: Int!
    isRepack: Boolean!
  }

  type CustomFormat {
    id: Int!
    name: String!
    includeCustomFormatWhenRenaming: Boolean!
    specifications: [Specification!]!
  }

  type Specification {
    id: Int!
    name: String!
    implementation: String!
    implementationName: String!
    infoLink: String!
    negate: Boolean!
    required: Boolean!
    fields: [SpecificationField!]!
    presets: [String!]!
  }

  type SpecificationField {
    order: Int!
    name: String!
    label: String!
    unit: String!
    helpText: String!
    helpTextWarning: String!
    helpLink: String!
    value: String!
    type: String!
    advanced: Boolean!
    selectOptions: [SelectOption!]!
    selectOptionsProviderAction: String!
    section: String!
    hidden: String!
    privacy: String!
    placeholder: String!
    isFloat: Boolean!
  }

  type SelectOption {
    value: Int!
    name: String!
    order: Int!
    hint: String!
  }

  type Episode {
    id: Int!
    seriesId: Int!
    tvdbId: Int!
    episodeFileId: Int!
    seasonNumber: Int!
    episodeNumber: Int!
    title: String!
    airDate: String!
    airDateUtc: String!
    lastSearchTime: String!
    runtime: Int!
    finaleType: String!
    overview: String!
    episodeFile: EpisodeFile!
    hasFile: Boolean!
    monitored: Boolean!
    absoluteEpisodeNumber: Int!
    sceneAbsoluteEpisodeNumber: Int!
    sceneEpisodeNumber: Int!
    sceneSeasonNumber: Int!
    unverifiedSceneNumbering: Boolean!
    endTime: String!
    grabDate: String!
    series: Series!
    images: [SeriesImage!]!
    torrent: Boolean!
    torrentType: String
    torrentFile: Torrent
  }
`
export default episodeSchema
