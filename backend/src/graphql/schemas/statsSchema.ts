const statsSchema = `
  type MediaCount {
    movies: Int!
    series: Int!
    episodes: Int!
  }

  type StatsSnapshot {
    timestamp: String!
    downloaded: MediaCount!
    deleted: MediaCount!
    diskUsage: Float!
    activeDownloads: Int!
    queuedDownloads: Int!
    failedDownloads: Int!
    totalBandwidth: Float!
  }

  type HourlyStats {
    hour: String!
    downloaded: MediaCount!
    deleted: MediaCount!
    averageDiskUsage: Float!
    averageBandwidth: Float!
    peakActiveDownloads: Int!
  }

  type Stats {
    _id: ID!
    currentSnapshot: StatsSnapshot!
    hourlyStats: [HourlyStats!]!
    dailyStats: [HourlyStats!]!
    created_at: String!
    updated_at: String!
  }

  type StatsReturn {
    data: Stats!
    tokens: [String!]!
  }
`

export default statsSchema