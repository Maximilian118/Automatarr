export interface MovieMetrics {
  downloaded: number
  deleted: number
  queued: number
  total_library_size: number
}

export interface SeriesMetrics {
  downloaded: number
  deleted: number
  queued: number
  total_library_size: number
  episodes_downloaded: number
  episodes_deleted: number
}

export interface StorageMetrics {
  total_storage: number
  free_storage: number
  minimum_free_storage: number
  used_percentage: number
  storage_consistency?: 'consistent' | 'inconsistent'
}

export interface SystemMetrics {
  active_users: number
  active_loops: number
  total_downloads: number
  failed_downloads: number
  blocked_downloads: number
}

export interface StatsDataPoint {
  timestamp: string
  movies: MovieMetrics
  series: SeriesMetrics
  storage: StorageMetrics
  system: SystemMetrics
}

export interface StatsType {
  _id: string
  data_points: StatsDataPoint[]
  created_at: string
  updated_at: string
}

export interface StatsQueryInput {
  hours_back?: number
  limit?: number
}

// Nivo line chart data format
export interface NivoDataPoint {
  x: string | Date
  y: number
}

export interface NivoLineData {
  id: string
  color?: string
  data: NivoDataPoint[]
}

// Time range options for the slider
export interface TimeRange {
  label: string
  hours: number
}

// Frequency options for data aggregation
export interface FrequencyOption {
  label: string
  minutes: number
}