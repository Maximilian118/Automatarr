type Image = {
  coverType: string
  url: string
  remoteUrl: string
}

type Language = {
  id: number
  name: string
}

type AlternateTitle = {
  title: string
  seasonNumber: number
  sceneSeasonNumber: number
  sceneOrigin: string
  comment: string
}

type SeasonStatistics = {
  nextAiring: string
  previousAiring: string
  episodeFileCount: number
  episodeCount: number
  totalEpisodeCount: number
  sizeOnDisk: number
  releaseGroups: string[]
  percentOfEpisodes: number
}

type Season = {
  seasonNumber: number
  monitored: boolean
  statistics: SeasonStatistics
  images: Image[]
}

type AddOptions = {
  ignoreEpisodesWithFiles: boolean
  ignoreEpisodesWithoutFiles: boolean
  monitor: string
  searchForMissingEpisodes: boolean
  searchForCutoffUnmetEpisodes: boolean
}

type SeriesRatings = {
  votes: number
  value: number
}

type SeriesStatistics = {
  seasonCount: number
  episodeFileCount: number
  episodeCount: number
  totalEpisodeCount: number
  sizeOnDisk: number
  releaseGroups: string[]
  percentOfEpisodes: number
}

export type Series = {
  id: number
  title: string
  alternateTitles: AlternateTitle[]
  sortTitle: string
  status: string
  ended: boolean
  profileName: string
  overview: string
  nextAiring: string
  previousAiring: string
  network: string
  airTime: string
  images: Image[]
  originalLanguage: Language
  remotePoster: string
  seasons: Season[]
  year: number
  path: string
  qualityProfileId: number
  seasonFolder: boolean
  monitored: boolean
  monitorNewItems: string
  useSceneNumbering: boolean
  runtime: number
  tvdbId: number
  tvRageId: number
  tvMazeId: number
  tmdbId: number
  firstAired: string
  lastAired: string
  seriesType: string
  cleanTitle: string
  imdbId: string
  titleSlug: string
  rootFolderPath: string
  folder: string
  certification: string
  genres: string[]
  tags: number[]
  added: string
  addOptions: AddOptions
  ratings: SeriesRatings
  statistics: SeriesStatistics
  episodesChanged: boolean
}
