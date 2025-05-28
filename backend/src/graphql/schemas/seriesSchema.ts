const seriesSchema = `
  type SeriesImage {
    coverType: String!
    url: String!
    remoteUrl: String!
  }

  type SeriesAlternateTitle {
    title: String!
    seasonNumber: Int!
    sceneSeasonNumber: Int!
    sceneOrigin: String!
    comment: String!
  }

  type SeriesSeasonStatistics {
    nextAiring: String!
    previousAiring: String!
    episodeFileCount: Int!
    episodeCount: Int!
    totalEpisodeCount: Int!
    sizeOnDisk: Float!
    releaseGroups: [String!]!
    percentOfEpisodes: Float!
  }

  type SeriesSeason {
    seasonNumber: Int!
    monitored: Boolean!
    statistics: SeriesSeasonStatistics!
    images: [SeriesImage!]!
    torrentsPresent: Boolean
    seasonTorrent: Torrent
    episodes: [Episode!]
  }

  type SeriesAddOptions {
    ignoreEpisodesWithFiles: Boolean!
    ignoreEpisodesWithoutFiles: Boolean!
    monitor: String!
    searchForMissingEpisodes: Boolean!
    searchForCutoffUnmetEpisodes: Boolean!
  }

  type SeriesRatings {
    votes: Int!
    value: Float!
  }

  type SeriesStatistics {
    seasonCount: Int!
    episodeFileCount: Int!
    episodeCount: Int!
    totalEpisodeCount: Int!
    sizeOnDisk: Float!
    releaseGroups: [String!]!
    percentOfEpisodes: Float!
  }

  type Series {
    id: Int!
    title: String!
    alternateTitles: [SeriesAlternateTitle!]!
    sortTitle: String!
    status: String!
    ended: Boolean!
    profileName: String!
    overview: String!
    nextAiring: String!
    previousAiring: String!
    network: String!
    airTime: String!
    images: [SeriesImage!]!
    originalLanguage: Language!
    remotePoster: String!
    seasons: [SeriesSeason!]!
    year: Int!
    path: String!
    qualityProfileId: Int!
    seasonFolder: Boolean!
    monitored: Boolean!
    monitorNewItems: String!
    useSceneNumbering: Boolean!
    runtime: Int!
    tvdbId: Int!
    tvRageId: Int!
    tvMazeId: Int!
    tmdbId: Int!
    firstAired: String!
    lastAired: String!
    seriesType: String!
    cleanTitle: String!
    imdbId: String!
    titleSlug: String!
    rootFolderPath: String!
    folder: String!
    certification: String!
    genres: [String!]!
    tags: [Int!]!
    added: String!
    addOptions: SeriesAddOptions!
    ratings: SeriesRatings!
    statistics: SeriesStatistics!
    episodesChanged: Boolean!
    torrentsPresent: Boolean
  }
`
export default seriesSchema
