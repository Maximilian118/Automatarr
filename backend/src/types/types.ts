import { Episode } from "./episodeTypes"
import { Movie } from "./movieTypes"
import { Series } from "./seriesTypes"

// Graphql err type
export interface graphqlErr {
  response: {
    status: number
    statusText: string
    headers: object
    config: object
    request: object
    data: {
      message: string
      content: string
      type?: string // if it's an error from the Starr App
      title?: string // if it's an error from the Starr App
      status?: number // if it's an error from the Starr App
      traceId?: string // if it's an error from the Starr App
      errors?: Record<string, string[]> // if it's an error from the Starr App
    }
  }
}

// Type for the LanguageSchema
export type Language = {
  id: number
  name: string
}

// Type for the basicQualitySchema
type BasicQuality = {
  id: number
  name: string
  source: string
  resolution: number
}

// Type for the qualityRevisionSchema
type QualityRevision = {
  version: number
  real: number
  isRepack: boolean
}
// Type for the qualitySchema
export type Quality = {
  quality: BasicQuality
  version?: number
  real?: number
  isRepack?: boolean
  revision: QualityRevision
}

// Type for the statusMessageSchema
type StatusMessage = {
  title: string
  messages: string[]
}

// Type for the downloadStatusSchema
export type DownloadStatus = {
  id: number
  languages: Language[]
  quality: Quality
  customFormats?: string[]
  customFormatScore?: number
  size: number
  title: string
  sizeleft: number
  timeleft?: string
  estimatedCompletionTime?: string
  added: string
  status: string
  trackedDownloadStatus: string
  trackedDownloadState: string
  statusMessages: StatusMessage[]
  downloadId: string
  protocol: string
  downloadClient: string
  downloadClientHasPostImportCategory: boolean
  indexer: string
  movieId?: number // Radarr-specific
  seriesId?: number // Sonarr-specific
  episodeId?: number // Sonarr-specific
  seasonNumber?: number // Sonarr-specific
  errorMessage?: string // Sonarr-specific
  outputPath?: string // Sonarr-specific
  episodeHasFile?: boolean // Sonarr-specific
  artistId?: number // Lidarr-specific
  albumId?: number // Lidarr-specific
  trackFileCount?: number // Lidarr-specific
  trackHasFileCount?: number // Lidarr-specific
  downloadForced?: boolean // Lidarr-specific
}

// All of the data for a single command
export type commandData = {
  name: string
  commandName: string
  body: Record<string, any>
  priority: string
  status: "queued" | "started" | "completed" | "failed" | "aborted"
  result: string
  queued: string
  started?: string
  ended?: string
  duration?: string
  trigger?: string
  stateChangeTime?: string
  sendUpdatesToClient?: boolean
  updateScheduledTask?: boolean
  lastExecutionTime?: string
  id: number
}

export type unmappedFolders = {
  name: string
  path: string
  relativePath: string
}

// Root Folder information
export type rootFolderData = {
  id: number
  name?: string
  path: string
  accessible: boolean
  freeSpace: number
  totalSpace?: number
  defaultTags?: number[]
  unmappedFolders?: unmappedFolders[]
  defaultNewItemMonitorOption?: string
  defaultMonitorOption?: string
  defaultQualityProfileId?: number
  defaultMetadataProfileId?: number
}

type Rejection = {
  reason: string
  type: string
}

export type ManualImportResponse = {
  id: number
  path: string
  relativePath: string
  folderName: string
  name: string
  size: number
  movie?: Movie // Radarr
  series?: Series // Sonarr
  episodes?: Episode[] // Sonarr
  // artists?: Artist // Lidarr prediction
  seasonNumber?: number // Sonarr
  quality: Quality
  languages: Language[]
  releaseGroup: string
  releaseType?: string // Sonarr
  qualityWeight: number
  downloadId: string
  customFormats: any[] // A lot of types for something I think will never need to be directely referenced
  customFormatScore: number
  indexerFlags: number
  rejections: Rejection[]
}
