const movieSchema = `
  type MovieAlternateTitle {
    sourceType: String!
    movieMetadataId: Int!
    title: String!
    id: Int!
  }

  type MovieImage {
    coverType: String!
    url: String!
    remoteUrl: String!
  }

  type MovieRating {
    votes: Int!
    value: Float!
    type: String!
  }

  type MovieRatings {
    imdb: MovieRating
    tmdb: MovieRating
    metacritic: MovieRating
    rottenTomatoes: MovieRating
    trakt: MovieRating
  }

  type MovieMediaInfo {
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

  type MovieLanguageData {
    key: String!
    value: String!
  }

  type MovieFile {
    movieId: Int!
    relativePath: String!
    path: String!
    size: Float!
    dateAdded: String!
    sceneName: String!
    releaseGroup: String!
    edition: String!
    languages: [MovieLanguageData!]!
    quality: Quality!
    customFormatScore: Int!
    indexerFlags: Int!
    mediaInfo: MovieMediaInfo!
    originalFilePath: String!
    qualityCutoffNotMet: Boolean!
    id: Int!
  }

  type MovieCollection {
    title: String!
    tmdbId: Int!
  }

  type MovieStatistics {
    movieFileCount: Int!
    sizeOnDisk: Float!
    releaseGroups: [String!]!
  }

  type Movie {
    title: String!
    originalTitle: String!
    originalLanguage: Language!
    alternateTitles: [MovieAlternateTitle!]!
    secondaryYear: Int
    secondaryYearSourceId: Int!
    sortTitle: String!
    sizeOnDisk: Float
    status: String!
    overview: String!
    inCinemas: String!
    physicalRelease: String!
    digitalRelease: String!
    releaseDate: String!
    images: [MovieImage!]!
    website: String!
    year: Int!
    youTubeTrailerId: String!
    studio: String!
    path: String!
    qualityProfileId: Int!
    hasFile: Boolean!
    movieFileId: Int!
    monitored: Boolean!
    minimumAvailability: String!
    isAvailable: Boolean!
    folderName: String!
    runtime: Int!
    cleanTitle: String!
    imdbId: String!
    tmdbId: Int!
    titleSlug: String!
    rootFolderPath: String!
    certification: String!
    genres: [String!]!
    tags: [Int!]!
    added: String!
    ratings: MovieRatings!
    movieFile: MovieFile!
    collection: MovieCollection!
    popularity: Float!
    lastSearchTime: String!
    statistics: MovieStatistics!
    torrent: Boolean!
    torrentType: String
    torrentFile: Torrent
    id: Int!
  }
`
export default movieSchema
