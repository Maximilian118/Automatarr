export type EventType =
  | "Test"
  | "Download" // Turns into "Import" or "Upgrade" based on the starrWebhookEventType() return
  | "Grab"
  | "MovieAdded"
  | "MovieDelete"
  | "MovieFileDelete"
  | "SeriesAdd"
  | "SeriesDelete"
  | "EpisodeFileDelete"
  | "Import" // Not actually an eventType from Starr apps. Returned from starrWebhookEventType()
  | "Upgrade" // Not actually an eventType from Starr apps. Returned from starrWebhookEventType()

export type tidyPaths = {
  path: string
  allowedDirs: string[]
}

// General information for all Bots
export type GeneralBotType = {
  max_movies: number | null // Maximum movies a user is allowed to have downloaded at the same time
  movie_pool_expiry: number | null // The amount of time a user can have any movie downloaded for. Null = Perpetual
  movie_quality_profile: string | null // The name of the quality profile to use for radarr downloads
  max_series: number | null // Maximum series a user is allowed to have downloaded at the same time
  series_pool_expiry: number | null // The amount of time a user can have any series downloaded for. Null = Perpetual
  series_quality_profile: string | null // The name of the quality profile to use for sonarr downloads
  min_free_space: string // A number representing the minimum amount of free space that must be left available
  welcome_message: string // A welcome message for new bot users
}

export type DiscordBotType = {
  active: boolean // Enable or disable Discord Bot
  ready: boolean // If the Bot is logged in and ready to go
  token: string // API Token for Discord Bot
  server_list: string[] // A list of server names to be fed to the front end
  server_name: string // The name of the selected server
  channel_list: string[] // A list of channels for the selected server to be fed to the frontend
  movie_channel_name: string // The channel that pertains to movie/Radarr commands
  series_channel_name: string // The channel that pertains to series/Sonarr commands
  music_channel_name: string // The channel that pertains to music/Lidarr commands
  books_channel_name: string // The channel that pertains to books/Readarr commands
  welcome_channel_name: string // The channel used to welcome new users
}

// Main settingsType
export interface settingsType {
  _id: string
  radarr_URL: string // URL including port to reach Radarr API. Example: localhost:7878/api/v3
  radarr_KEY: string // API KEY for Radarr
  radarr_API_version: string // Radarr API Version
  radarr_active: boolean // Has Radarr connection been tested and therefore should be included in requests?
  sonarr_URL: string // URL including port to reach Sonarr API. Example: localhost:8989/api/v3
  sonarr_KEY: string // API KEY for Sonarr
  sonarr_API_version: string // Sonarr API Version
  sonarr_active: boolean // Has Sonarr connection been tested and therefore should be included in requests?
  lidarr_URL: string // URL including port to reach Lidarr API. Example: localhost:8686/api/v1
  lidarr_KEY: string // API KEY for Lidarr
  lidarr_API_version: string // Lidarr API Version
  lidarr_active: boolean // Has Lidarr connection been tested and therefore should be included in requests?
  remove_blocked: boolean // Enable or disable automation of handling Starr app files with importBlocked in API queues
  wanted_missing: boolean // Enable or disable automation of searching for missing and monitored library items
  remove_failed: boolean // Enable or disable automation of removing failed downloads
  remove_missing: boolean // Enable or disable automation of removing files from the file system that no longer appear in any Starr app library
  permissions_change: boolean // Enable or disable automation of changing all directories and files inside Starr app root folders to a user and group
  tidy_directories: boolean // Enable or disable automation of removing unwanted files in specified directories
  remove_blocked_loop: number // Loop timer for importBlocked. Unit = minutes
  wanted_missing_loop: number // Loop timer for wanted missing search. Unit = minutes
  remove_failed_loop: number // Loop timer for remove_failed. Unit = minutes
  remove_missing_loop: number // Loop timer for remove_missing. Unit = minutes
  remove_missing_level: "Library" | "Import List" // The level that which remove missing removes files from the file system. Library = Any file that isn't in Library. Import List = Any file that isn't in Import Lists.
  permissions_change_loop: number // Loop timer for permissions_change. Unit = minutes
  permissions_change_chown: string // Intended ownership of all content inside Starr app root folders
  permissions_change_chmod: string // Intended permissions of all content inside Starr app root folders
  tidy_directories_loop: number // Loop timer for tidy_directories. Unit = minutes
  tidy_directories_paths: tidyPaths[] // An Array of paths to loop through removing all children that are not allowed. Allowed children are specified in the allowedDirs array.
  qBittorrent_URL: string // URL including port to reach qBittorrent API
  qBittorrent_username: string // Username for qBittorrent if it requires credentials
  qBittorrent_password: string // Password for qBittorrent if it requires credentials
  qBittorrent_active: boolean // Has qBittorrent connection been tested and therefore should be included in requests?
  qBittorrent_API_version: string // qBittorrent API Version
  general_bot: GeneralBotType // General information for all Bots
  discord_bot: DiscordBotType // Discord Bot settings/data
  lockout: boolean // Enable or disable the lockout mechanism
  lockout_attempts: number | null // Amount of tries before lockout
  lockout_mins: number | null // How long the lockout is for
  webhooks: boolean // Enable or disable webhooks
  webhooks_enabled: EventType[] // An array of webhooks the user would like
  webhooks_token: string // A randomly generated token for connecting webhooks to Automatarr
  created_at: string // When Settings was created.
  updated_at: string // When Settings was updated.
}

// An error type mirroring settingsType to use with forms
export type settingsErrorType = {
  [K in keyof settingsType]: string
}
