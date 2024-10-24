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
  import_blocked_loop: number
  wanted_missing_loop: number
  qBittorrent_URL: string
  qBittorrent_username: string
  qBittorrent_password: string
  qBittorrent_active: boolean
  created_at: string
  updated_at: string
}

export interface settingsErrorType {
  _id: string
  radarr_URL: string
  radarr_KEY: string
  radarr_API_version: string
  radarr_active: string
  sonarr_URL: string
  sonarr_KEY: string
  sonarr_API_version: string
  sonarr_active: string
  lidarr_URL: string
  lidarr_KEY: string
  lidarr_API_version: string
  lidarr_active: string
  import_blocked: string
  wanted_missing: string
  import_blocked_loop: string
  wanted_missing_loop: string
  qBittorrent_URL: string
  qBittorrent_username: string
  qBittorrent_password: string
  qBittorrent_active: string
  created_at: string
  updated_at: string
}
