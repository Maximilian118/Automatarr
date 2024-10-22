import { settingsErrorType } from "./types"

// Initialise the settings object with defaults
export const initSettings = {
  _id: "",
  radarr_URL: "",
  radarr_KEY: "",
  sonarr_URL: "",
  sonarr_KEY: "",
  lidarr_URL: "",
  lidarr_KEY: "",
  import_blocked: true,
  wanted_missing: true,
  import_blocked_loop: 10,
  wanted_missing_loop: 240,
  qBittorrent_URL: "",
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

// Initialise object for API connection checks
export const initValidAPI = {
  radarr: false,
  sonarr: false,
  lidarr: false,
  qBittorrent: false,
}
