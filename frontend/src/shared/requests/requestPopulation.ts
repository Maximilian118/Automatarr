// Population fields for a settings request
export const populateSettings = `
  _id
  radarr_URL
  radarr_KEY
  radarr_API_version
  radarr_active
  sonarr_URL
  sonarr_KEY
  sonarr_API_version
  sonarr_active
  lidarr_URL
  lidarr_KEY
  lidarr_API_version
  lidarr_active
  import_blocked
  wanted_missing
  remove_failed
  remove_missing
  permissions_change
  tidy_directories
  import_blocked_loop
  wanted_missing_loop
  remove_failed_loop
  remove_missing_loop
  remove_missing_level
  permissions_change_loop
  permissions_change_chown
  permissions_change_chmod
  tidy_directories_loop
  tidy_directories_paths {
    path
    allowedDirs
  }
  qBittorrent_URL
  qBittorrent_username
  qBittorrent_password
  qBittorrent_active
  qBittorrent_API_version
  general_bot {
    max_movies
    movie_pool_expiry
    max_series
    series_pool_expiry
    users {
      name
      ids
      super_user
      max_movies_overwrite
      max_series_overwrite
    }
  }
  discord_bot {
    active
    ready
    token
    server_list
    server_name
    server_id
    channel_list
    channel_name
    channel_id
  }
  created_at
  updated_at
`
