export interface settingsType {
  _id: string
  radarr_URL: string
  radarr_KEY: string
  sonarr_URL: string
  sonarr_KEY: string
  lidarr_URL: string
  lidarr_KEY: string
  import_blocked: boolean
  wanted_missing: boolean
  import_blocked_loop: number
  wanted_missing_loop: number
  qBittorrent_URL: string
  created_at: string
  updated_at: string
}

export interface settingsErrorType {
  _id: string
  radarr_URL: string
  radarr_KEY: string
  sonarr_URL: string
  sonarr_KEY: string
  lidarr_URL: string
  lidarr_KEY: string
  import_blocked: string
  wanted_missing: string
  import_blocked_loop: string
  wanted_missing_loop: string
  qBittorrent_URL: string
  created_at: string
  updated_at: string
}
