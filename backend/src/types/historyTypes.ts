export type RadarrHistoryEventType =
  | "grabbed"
  | "downloadFolderImported"
  | "downloadFailed"
  | "movieFileDeleted"
  | "movieFileRenamed"
  | "movieFileImported"
  | "unknown"

export interface HistoryItem {
  id: number
  movieId: number
  sourceTitle: string
  languages: {
    id: number
    name: string
  }[]
  quality: {
    quality: {
      id: number
      name: string
      source: "web" | "bluray" | "hdtv" | "unknown"
      resolution: number
      modifier: string
    }
    revision: {
      version: number
      real: number
      isRepack: boolean
    }
  }
  customFormats: {
    id: number
    name: string
  }[]
  customFormatScore: number
  qualityCutoffNotMet: boolean
  date: string // ISO string
  downloadId?: string
  eventType: RadarrHistoryEventType
  data: {
    fileId?: string
    droppedPath?: string
    importedPath?: string
    downloadClient?: string
    downloadClientName?: string
    releaseGroup?: string
    size?: string
    indexer?: string
    downloadUrl?: string
    guid?: string
    protocol?: string
    movieMatchType?: string
    releaseSource?: string
    tmdbId?: string
    imdbId?: string
  }
}
