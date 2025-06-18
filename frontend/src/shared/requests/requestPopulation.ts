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
  remove_blocked
  wanted_missing
  remove_failed
  remove_missing
  permissions_change
  tidy_directories
  remove_blocked_loop
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
    movie_quality_profile
    max_series
    series_pool_expiry
    series_quality_profile
    min_free_space
    welcome_message
  }
  discord_bot {
    active
    ready
    token
    server_list
    server_name
    channel_list
    movie_channel_name
    series_channel_name
    music_channel_name
    books_channel_name
    welcome_channel_name
  }
  lockout
  lockout_attempts
  lockout_mins
  webhooks
  webhooks_enabled
  webhooks_token
  created_at
  updated_at
  tokens
`

// Population fields for a user request
export const populateUser = `
  _id
  name
  password
  refresh_count
  admin
  email
  icon
  profile_picture
  logged_in_at
  created_at
  updated_at
  tokens
`
