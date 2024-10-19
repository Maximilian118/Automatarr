const settingsSchema = `
  type Settings {
    _id: String!
    Radarr_URL: String!
    Radarr_KEY: String!
    Sonarr_URL: String!
    Sonarr_KEY: String!
    Lidarr_URL: String!
    Lidarr_KEY: String!
    Import_Blocked: Boolean!
    Wanted_Missing: Boolean!
    Import_Blocked_Loop: Int!
    Wanted_Missing_Loop: Int!
    qBittorrent_URL: String!
    created_at: String!
    updated_at: String!
  }

  input settingsInput {
    _id: String!
    Radarr_URL: String
    Radarr_KEY: String
    Sonarr_URL: String
    Sonarr_KEY: String
    Lidarr_URL: String
    Lidarr_KEY: String
    Import_Blocked: Boolean
    Wanted_Missing: Boolean
    Import_Blocked_Loop: Int
    Wanted_Missing_Loop: Int
    qBittorrent_URL: String
  }
`
export default settingsSchema
