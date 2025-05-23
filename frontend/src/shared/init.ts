import { botsErrType } from "../types/botType"
import { dataType } from "../types/dataType"
import { settingsErrorType, settingsType } from "../types/settingsType"

const initGeneralBot = {
  max_movies: 10, // Maximum movies a user is allowed to have downloaded at the same time
  movie_pool_expiry: null, // The amount of time a user can have any movie downloaded for. Null = Perpetual
  max_series: 2, // Maximum series a user is allowed to have downloaded at the same time
  series_pool_expiry: null, // The amount of time a user can have any series downloaded for. Null = Perpetual
  users: [], // An array of registered users
}

const initDiscordBot = {
  active: false, // Enable or disable Discord Bot
  ready: false, // If the Bot is logged in and ready to go
  token: "", // API Token for Discord Bot
  server_list: [], // A list of server names to be fed to the front end
  server_name: "", // The name of the selected server
  channel_list: [], // A list of channels for the selected server to be fed to the frontend
  movie_channel_name: "", // The channel that pertains to movie/Radarr commands
  series_channel_name: "", // The channel that pertains to series/Sonarr commands
  music_channel_name: "", // The channel that pertains to music/Lidarr commands
  books_channel_name: "", // The channel that pertains to books/Readarr commands
}

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
  general_bot: initGeneralBot,
  discord_bot: initDiscordBot,
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

// Initialise botErr object with defaults
export const initBotErr: botsErrType = {
  discord_bot_token: "",
  discord_bot_server_name: "",
  discord_bot_channel_name: "",
}
