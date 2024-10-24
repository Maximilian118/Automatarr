const settingsSchema = `
  type Settings {
    _id: ID!
    radarr_URL: String!
    radarr_KEY: String!
    radarr_API_version: String!
    radarr_active: Boolean!
    sonarr_URL: String!
    sonarr_KEY: String!
    sonarr_API_version: String!
    sonarr_active: Boolean!
    lidarr_URL: String!
    lidarr_KEY: String!
    lidarr_API_version: String!
    lidarr_active: Boolean!
    import_blocked: Boolean!
    wanted_missing: Boolean!
    import_blocked_loop: Int!
    wanted_missing_loop: Int!
    qBittorrent_URL: String!
    qBittorrent_username: String!
    qBittorrent_password: String!
    qBittorrent_active: Boolean!
    created_at: String!
    updated_at: String!
  }

  input settingsInput {
    _id: ID!
    radarr_URL: String
    radarr_KEY: String
    radarr_API_version: String
    radarr_active: Boolean
    sonarr_URL: String
    sonarr_KEY: String
    sonarr_API_version: String
    sonarr_active: Boolean
    lidarr_URL: String
    lidarr_KEY: String
    lidarr_API_version: String
    lidarr_active: Boolean
    import_blocked: Boolean
    wanted_missing: Boolean
    import_blocked_loop: Int
    wanted_missing_loop: Int
    qBittorrent_URL: String
    qBittorrent_username: String
    qBittorrent_password: String
    qBittorrent_active: Boolean
  }
`
export default settingsSchema
