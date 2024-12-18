const settingsSchema = `
  type TidyPaths {
    path: String!
    allowedDirs: [String!]
  }

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
    remove_failed: Boolean!
    remove_missing: Boolean!
    permissions_change: Boolean!
    tidy_directories: Boolean!
    import_blocked_loop: Int!
    wanted_missing_loop: Int!
    remove_failed_loop: Int!
    remove_missing_loop: Int!
    remove_missing_level: String!
    permissions_change_loop: Int!
    permissions_change_chown: String!
    permissions_change_chmod: String!
    tidy_directories_loop: Int!
    tidy_directories_paths: [TidyPaths!]!
    qBittorrent_URL: String!
    qBittorrent_username: String!
    qBittorrent_password: String!
    qBittorrent_active: Boolean!
    qBittorrent_API_version: String!
    created_at: String!
    updated_at: String!
  }

  input tidyPaths {
    path: String!
    allowedDirs: [String!]
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
    remove_failed: Boolean
    remove_missing: Boolean
    permissions_change: Boolean
    tidy_directories: Boolean
    import_blocked_loop: Int
    wanted_missing_loop: Int
    remove_failed_loop: Int
    remove_missing_loop: Int
    remove_missing_level: String
    permissions_change_loop: Int
    permissions_change_chown: String
    permissions_change_chmod: String
    tidy_directories_loop: Int
    tidy_directories_paths: [tidyPaths!]!
    qBittorrent_URL: String
    qBittorrent_username: String
    qBittorrent_password: String
    qBittorrent_active: Boolean
    qBittorrent_API_version: String
  }
`
export default settingsSchema
