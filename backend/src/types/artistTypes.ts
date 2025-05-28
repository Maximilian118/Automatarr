type Image = {
  url: string
  coverType: string
  extension: string
  remoteUrl: string
}

type Link = {
  url: string
  name: string
}

type Rating = {
  votes: number
  value: number
}

type Statistics = {
  albumCount: number
  trackFileCount: number
  trackCount: number
  totalTrackCount: number
  sizeOnDisk: number
  percentOfTracks: number
}

type AddOptions = {
  monitor: string
  albumsToMonitor: string[]
  monitored: boolean
  searchForMissingAlbums: boolean
}

type Media = {
  mediumNumber: number
  mediumName: string
  mediumFormat: string
}

type Release = {
  id: number
  albumId: number
  foreignReleaseId: string
  title: string
  status: string
  duration: number
  trackCount: number
  media: Media[]
  mediumCount: number
  disambiguation: string
  country: string[]
  label: string[]
  format: string
  monitored: boolean
}

export type Album = {
  id: number
  title: string
  disambiguation: string
  overview: string
  artistId: number
  foreignAlbumId: string
  monitored: boolean
  anyReleaseOk: boolean
  profileId: number
  duration: number
  albumType: string
  secondaryTypes: string[]
  mediumCount: number
  ratings: Rating
  releaseDate: string
  releases: Release[]
  genres: string[]
  media: Media[]
  artist: string
  images: Image[]
  links: Link[]
  lastSearchTime: string
  statistics: {
    trackFileCount: number
    trackCount: number
    totalTrackCount: number
    sizeOnDisk: number
    percentOfTracks: number
  }
  addOptions: {
    addType: string
    searchForNewAlbum: boolean
  }
  remoteCover: string
}

type ArtistMember = {
  name: string
  instrument: string
  images: Image[]
}

export type Artist = {
  id: number
  status: string
  ended: boolean
  artistName: string
  foreignArtistId: string
  mbId: string
  tadbId: number
  discogsId: number
  allMusicId: string
  overview: string
  artistType: string
  disambiguation: string
  links: Link[]
  nextAlbum: Album
  lastAlbum: Album
  images: Image[]
  members: ArtistMember[]
  remotePoster: string
  path: string
  qualityProfileId: number
  metadataProfileId: number
  monitored: boolean
  monitorNewItems: string
  rootFolderPath: string
  folder: string
  genres: string[]
  cleanName: string
  sortName: string
  tags: number[]
  added: string
  addOptions: AddOptions
  ratings: Rating
  statistics: Statistics
}
