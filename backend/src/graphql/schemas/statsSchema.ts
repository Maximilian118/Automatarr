const statsSchema = `
  type MovieMetrics {
    downloaded: Int!
    deleted: Int!
    queued: Int!
    total_library_size: Int!
  }

  type SeriesMetrics {
    downloaded: Int!
    deleted: Int!
    queued: Int!
    total_library_size: Int!
    episodes_downloaded: Int!
    episodes_deleted: Int!
  }

  type StorageMetrics {
    total_storage: Float!
    free_storage: Float!
    minimum_free_storage: Float!
    used_percentage: Float!
  }

  type SystemMetrics {
    active_users: Int!
    active_loops: Int!
    total_downloads: Int!
    failed_downloads: Int!
    blocked_downloads: Int!
  }

  type StatsDataPoint {
    timestamp: String!
    movies: MovieMetrics!
    series: SeriesMetrics!
    storage: StorageMetrics!
    system: SystemMetrics!
  }

  type Stats {
    _id: ID!
    data_points: [StatsDataPoint!]!
    created_at: String!
    updated_at: String!
  }

  input StatsQueryInput {
    hours_back: Int
    limit: Int
  }
`

export default statsSchema