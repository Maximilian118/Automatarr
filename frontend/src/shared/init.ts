import { dataType } from "../types/dataType"
import { settingsErrorType, settingsType } from "../types/settingsType"

// Initialise the settings object with defaults
export const initSettings: settingsType = {
  _id: "",
  radarr_URL: "",
  radarr_KEY: "",
  radarr_API_version: "v3",
  radarr_active: false,
  sonarr_URL: "",
  sonarr_KEY: "",
  sonarr_API_version: "v3",
  sonarr_active: false,
  lidarr_URL: "",
  lidarr_KEY: "",
  lidarr_API_version: "v1",
  lidarr_active: false,
  import_blocked: false,
  wanted_missing: false,
  remove_failed: false,
  remove_missing: false,
  permissions_change: false,
  tidy_directories: false,
  import_blocked_loop: 10,
  wanted_missing_loop: 240,
  remove_failed_loop: 60,
  remove_missing_loop: 60,
  remove_missing_level: "Library",
  permissions_change_loop: 10,
  permissions_change_chown: "",
  permissions_change_chmod: "",
  tidy_directories_loop: 60,
  tidy_directories_paths: [],
  qBittorrent_URL: "",
  qBittorrent_username: "",
  qBittorrent_password: "",
  qBittorrent_active: false,
  qBittorrent_API_version: "v2",
  discord_bot_active: false,
  discord_bot_ready: false,
  discord_bot_token: "",
  discord_bot_server_id: "",
  discord_bot_channel_id: "",
  created_at: "",
  updated_at: "",
}

// Create an object with the same keys as initSettings but all values are ""
export const initSettingsErrors = (): settingsErrorType => {
  const errObj = {} as settingsErrorType

  for (const key in initSettings) {
    if (Object.prototype.hasOwnProperty.call(initSettings, key)) {
      errObj[key as keyof settingsErrorType] = ""
    }
  }

  return errObj
}

// Initialise the data object with defaults
export const initData: dataType = {
  _id: "",
  created_at: "",
  updated_at: "",
}
