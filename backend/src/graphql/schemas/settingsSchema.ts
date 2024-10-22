const settingsSchema = `
  type Settings {
    _id: ID!
    radarr_URL: String!
    radarr_KEY: String!
    sonarr_URL: String!
    sonarr_KEY: String!
    lidarr_URL: String!
    lidarr_KEY: String!
    import_blocked: Boolean!
    wanted_missing: Boolean!
    import_blocked_loop: Int!
    wanted_missing_loop: Int!
    qBittorrent_URL: String!
    created_at: String!
    updated_at: String!
  }

  input settingsInput {
    _id: ID!
    radarr_URL: String
    radarr_KEY: String
    sonarr_URL: String
    sonarr_KEY: String
    lidarr_URL: String
    lidarr_KEY: String
    import_blocked: Boolean
    wanted_missing: Boolean
    import_blocked_loop: Int
    wanted_missing_loop: Int
    qBittorrent_URL: String
  }
`
export default settingsSchema
