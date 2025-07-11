import mongoose, { Document } from "mongoose"
import moment from "moment"
import { ObjectId } from "mongodb"
import { Movie } from "../types/movieTypes"
import { Series } from "../types/seriesTypes"
import { Album } from "../types/artistTypes"
import crypto from "crypto"
import { EventType } from "./webhook"

// A quick note on what files need to be updated when we add or remove from settings.
// Due to how docker works, we can't easily reference type definitions from outside project folders.
// Therefore, we have two type definiations and initialisations, one for the backend and frontend respectively.
//
// Backend:
// - settings.ts // Type and init
// - settingsSchema.ts // Schema
// - settingsResolvers.ts > updateSettings // Resolver
//
// Frontend:
// - types > settingsType.ts // Type
// - shared > init.ts // Init
// - shared > requests > settingsRequests.ts > updateSettings // request
// - shared > requestPopulation.ts // requested return fields

type tidyPaths = {
  path: string
  allowedDirs: string[]
}

export type PoolType = {
  movies: Movie[] // Array of Movies this user has downloaded
  series: Series[] // Array of Series this user has downloaded
  albums: Album[] // Array of Albums this user has downloaded
  books: unknown[] // Array of Books this user has downloaded
}

export type BotUserType = {
  _id?: ObjectId
  name: string // The name of the user
  ids: string[] // An array of ID's this user is known by. (In case of multiple bots)
  admin: boolean // True = This user is an admin and can add / remove users
  super_user: boolean // True = Can overwrite general restrictions
  max_movies_overwrite: number | null // Maximum movies this specific user is allowed to have downloaded at the same time
  max_series_overwrite: number | null // Maximum series this specific user is allowed to have downloaded at the same time
  pool: PoolType // Pool of content this user has downloaded
  created_at: string // When user was created.
  updated_at: string // When user was updated.
}

export type AvailableBots = "Discord" | "Whatsapp" | ""

// General information for all Bots
type GeneralBotType = {
  max_movies: number | null // Maximum movies a user is allowed to have downloaded at the same time. Null = Infinite
  movie_pool_expiry: number | null // The amount of time a user can have any movie downloaded for. Null = Perpetual
  movie_quality_profile: string | null // The name of the quality profile to use for radarr downloads
  max_series: number | null // Maximum series a user is allowed to have downloaded at the same time. Null = Infinite
  series_pool_expiry: number | null // The amount of time a user can have any series downloaded for. Null = Perpetual
  series_quality_profile: string | null // The name of the quality profile to use for sonarr downloads
  min_free_space: string // A number representing the minimum amount of free space that must be left available
  welcome_message: string // A welcome message for new bot users
  auto_init: AvailableBots // Automatically initialise a user pool for every new bot user. Only available on one bot of the server owners choosing.
  users: BotUserType[] // An array of registered users
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
  _id: ObjectId
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
  lockout_attempts: number // Amount of tries before lockout
  lockout_mins: number // How long the lockout is for
  webhooks: boolean // Enable or disable webhooks
  webhooks_enabled: EventType[] // An array of webhooks the user would like
  webhooks_token: string // A randomly generated token for connecting webhooks to Automatarr
  backups: boolean // Enable or disable backups
  backups_loop: number // Loop timer for backups. Unit = minutes
  backups_rotation_date: number // The amount of time that determines when we start deleting log files
  created_at: string // When Settings was created.
  updated_at: string // When Settings was updated.
  tokens: string[] // Tokens to be sent in resolver return for session data.
  [key: string]: any
}

// Settings object from MongoDB Database
export interface settingsDocType extends settingsType, Document {
  _id: ObjectId
  _doc: settingsType
}

const tidyDirPathsSchema = new mongoose.Schema<tidyPaths>({
  path: { type: String, required: true },
  allowedDirs: { type: [String], required: true },
})

const poolSchema = new mongoose.Schema<PoolType>({
  movies: { type: mongoose.Schema.Types.Mixed, default: [] },
  series: { type: mongoose.Schema.Types.Mixed, default: [] },
  albums: { type: mongoose.Schema.Types.Mixed, default: [] },
  books: { type: mongoose.Schema.Types.Mixed, default: [] },
})

const userSchema = new mongoose.Schema<BotUserType>({
  name: { type: String, required: true },
  ids: { type: [String], required: true },
  admin: { type: Boolean, default: false },
  super_user: { type: Boolean, default: false },
  max_movies_overwrite: { type: Number, default: 10 },
  max_series_overwrite: { type: Number, default: 2 },
  pool: { type: poolSchema, default: () => ({}) },
  created_at: { type: String, default: moment().format() },
  updated_at: { type: String, default: moment().format() },
})

const generalBotSchema = new mongoose.Schema<GeneralBotType>({
  max_movies: { type: Number, default: 10 },
  movie_pool_expiry: { type: Number, default: null },
  movie_quality_profile: { type: String, default: null },
  max_series: { type: Number, default: 2 },
  series_pool_expiry: { type: Number, default: null },
  series_quality_profile: { type: String, default: null },
  min_free_space: { type: String, default: "21474836480" }, // 20gb
  welcome_message: { type: String, default: "" },
  auto_init: { type: String, default: "" },
  users: { type: [userSchema], default: [] },
})

const discordBotSchema = new mongoose.Schema<DiscordBotType>({
  active: { type: Boolean, default: false },
  ready: { type: Boolean, default: false },
  token: { type: String, default: "" },
  server_list: { type: [String], default: [] },
  server_name: { type: String, default: "" },
  channel_list: { type: [String], default: [] },
  movie_channel_name: { type: String, default: "" },
  series_channel_name: { type: String, default: "" },
  music_channel_name: { type: String, default: "" },
  books_channel_name: { type: String, default: "" },
  welcome_channel_name: { type: String, default: "" },
})

const settingsSchema = new mongoose.Schema<settingsType>(
  {
    radarr_URL: { type: String, default: "" },
    radarr_KEY: { type: String, default: "" },
    radarr_API_version: { type: String, default: "v3" },
    radarr_active: { type: Boolean, default: false },
    sonarr_URL: { type: String, default: "" },
    sonarr_KEY: { type: String, default: "" },
    sonarr_API_version: { type: String, default: "v3" },
    sonarr_active: { type: Boolean, default: false },
    lidarr_URL: { type: String, default: "" },
    lidarr_KEY: { type: String, default: "" },
    lidarr_API_version: { type: String, default: "v1" },
    lidarr_active: { type: Boolean, default: false },
    remove_blocked: { type: Boolean, default: false },
    wanted_missing: { type: Boolean, default: false },
    remove_failed: { type: Boolean, default: false },
    remove_missing: { type: Boolean, default: false },
    permissions_change: { type: Boolean, default: false },
    tidy_directories: { type: Boolean, default: false },
    remove_blocked_loop: { type: Number, default: 10 },
    wanted_missing_loop: { type: Number, default: 240 },
    remove_failed_loop: { type: Number, default: 60 },
    remove_missing_loop: { type: Number, default: 60 },
    remove_missing_level: { type: String, default: "Import List" },
    permissions_change_loop: { type: Number, default: 10 },
    permissions_change_chown: { type: String, default: "" },
    permissions_change_chmod: { type: String, default: "" },
    tidy_directories_loop: { type: Number, default: 60 },
    tidy_directories_paths: { type: [tidyDirPathsSchema], default: [] },
    qBittorrent_URL: { type: String, default: "" },
    qBittorrent_username: { type: String, default: "" },
    qBittorrent_password: { type: String, default: "" },
    qBittorrent_active: { type: Boolean, default: false },
    qBittorrent_API_version: { type: String, default: "v2" },
    general_bot: { type: generalBotSchema, default: () => ({}) },
    discord_bot: { type: discordBotSchema, default: () => ({}) },
    lockout: { type: Boolean, default: true },
    lockout_attempts: { type: Number, default: 5 },
    lockout_mins: { type: Number, default: 60 },
    webhooks: { type: Boolean, default: false },
    webhooks_enabled: { type: [String], default: [] },
    webhooks_token: { type: String, default: crypto.randomBytes(32).toString("hex") },
    backups: { type: Boolean, default: false },
    backups_loop: { type: Number, default: 1440 },
    backups_rotation_date: { type: Number, default: 525600 }, // 1 year
    created_at: { type: String, default: moment().format() },
    updated_at: { type: String, default: moment().format() },
  },
  {
    optimisticConcurrency: true, // Fixes an issue with __v not updating in db on save().
  },
)

const Settings = mongoose.model<settingsType>("Settings", settingsSchema)

export default Settings
