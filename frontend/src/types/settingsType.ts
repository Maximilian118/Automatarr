export type tidyPaths = {
  path: string
  allowedDirs: string[]
}

// Main settingsType
export interface settingsType {
  _id: string
  radarr_URL: string
  radarr_KEY: string
  radarr_API_version: string
  radarr_active: boolean
  sonarr_URL: string
  sonarr_KEY: string
  sonarr_API_version: string
  sonarr_active: boolean
  lidarr_URL: string
  lidarr_KEY: string
  lidarr_API_version: string
  lidarr_active: boolean
  import_blocked: boolean
  wanted_missing: boolean
  remove_failed: boolean
  remove_missing: boolean
  permissions_change: boolean
  tidy_directories: boolean
  import_blocked_loop: number
  wanted_missing_loop: number
  remove_failed_loop: number
  remove_missing_loop: number
  remove_missing_level: "Library" | "Import List"
  permissions_change_loop: number
  permissions_change_chown: string
  permissions_change_chmod: string
  tidy_directories_loop: number
  tidy_directories_paths: tidyPaths[]
  qBittorrent_URL: string
  qBittorrent_username: string
  qBittorrent_password: string
  qBittorrent_active: boolean
  qBittorrent_API_version: string
  discord_bot_active: boolean
  discord_bot_ready: boolean
  discord_bot_token: string
  discord_bot_server_id: string
  discord_bot_channel_id: string
  created_at: string
  updated_at: string
}

// An error type mirroring settingsType to use with forms
export type settingsErrorType = {
  [K in keyof settingsType]: string
}
