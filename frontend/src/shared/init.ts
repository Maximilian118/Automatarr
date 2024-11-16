import { settingsErrorType, settingsType } from "./types"

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
  import_blocked: true,
  wanted_missing: true,
  remove_failed: true,
  remove_missing: true,
  permissions_change: false,
  import_blocked_loop: 10,
  wanted_missing_loop: 240,
  remove_failed_loop: 60,
  remove_missing_loop: 60,
  permissions_change_loop: 10,
  qBittorrent_URL: "",
  qBittorrent_username: "",
  qBittorrent_password: "",
  qBittorrent_active: false,
  qBittorrent_API_version: "v2",
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
