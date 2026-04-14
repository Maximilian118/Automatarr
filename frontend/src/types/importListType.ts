// Individual field within an import list configuration
export type ImportListField = {
  order: number
  name: string
  label: string
  helpText: string
  value: string
  type: string
  advanced: boolean
  privacy: string
  isFloat: boolean
}

// A single import list entry from Radarr or Sonarr
export type ImportListData = {
  id: number
  enabled?: boolean
  // Radarr-specific fields
  enableAuto?: boolean
  monitor?: string
  searchOnAdd?: boolean
  minimumAvailability?: string
  // Sonarr-specific fields
  enableAutomaticAdd?: boolean
  searchForMissingEpisodes?: boolean
  shouldMonitor?: string
  monitorNewItems?: string
  seriesType?: string
  seasonFolder?: boolean
  // Common fields
  rootFolderPath: string
  qualityProfileId: number
  listType: string
  listOrder: number
  minRefreshInterval: string
  name: string
  fields: ImportListField[]
  implementationName: string
  implementation: string
  configContract: string
  infoLink: string
  tags: number[]
}

// Import lists grouped by API name
export type ImportList = {
  name: "Radarr" | "Sonarr"
  data: ImportListData[]
}

// Root folder paths grouped by API name
export type RootFolderPaths = {
  name: "Radarr" | "Sonarr"
  paths: string[]
}

// Input for creating a new import list
export type ImportListCreateInput = {
  apiName: string
  name: string
  url: string
  enabled?: boolean
  qualityProfileId: number
  rootFolderPath: string
  searchOnAdd?: boolean
}

// Input for updating an existing import list
export type ImportListUpdateInput = {
  apiName: string
  id: number
  name?: string
  url?: string
  enabled?: boolean
  qualityProfileId?: number
  rootFolderPath?: string
  searchOnAdd?: boolean
}

// Stats for a single import list (downloaded/downloading/missing counts + disk usage)
export type ImportListStats = {
  listId: number
  total: number
  downloaded: number
  downloading: number
  missing: number
  sizeOnDisk: number
  error: boolean
  errorMessage?: string
}

// Stats grouped by API name
export type ImportListApiStats = {
  name: "Radarr" | "Sonarr"
  stats: ImportListStats[]
}
