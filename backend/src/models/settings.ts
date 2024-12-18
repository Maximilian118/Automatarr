import mongoose, { Document } from "mongoose"
import moment from "moment"
import { ObjectId } from "mongodb"

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

// Main settingsType
export interface settingsType {
  _id: ObjectId
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
  created_at: string
  updated_at: string
  [key: string]: any
}

// Settings object from MongoDB Database
export interface settingsDocType extends settingsType, Document {
  _id: ObjectId
  _doc: settingsType
}

export const tidyDirPathsSchema = new mongoose.Schema<tidyPaths>({
  path: { type: String, required: true },
  allowedDirs: { type: [String], required: true },
})

const settingsSchema = new mongoose.Schema<settingsType>({
  radarr_URL: { type: String, default: "" }, // URL including port to reach Radarr API. Example: localhost:7878/api/v3
  radarr_KEY: { type: String, default: "" }, // API KEY for Radarr
  radarr_API_version: { type: String, default: "v3" }, // Radarr API Version
  radarr_active: { type: Boolean, default: false }, // Has Radarr connection been tested and therefore should be included in requests?
  sonarr_URL: { type: String, default: "" }, // URL including port to reach Sonarr API. Example: localhost:8989/api/v3
  sonarr_KEY: { type: String, default: "" }, // API KEY for Sonarr
  sonarr_API_version: { type: String, default: "v3" }, // Sonarr API Version
  sonarr_active: { type: Boolean, default: false }, // Has Sonarr connection been tested and therefore should be included in requests?
  lidarr_URL: { type: String, default: "" }, // URL including port to reach Lidarr API. Example: localhost:8686/api/v1
  lidarr_KEY: { type: String, default: "" }, // API KEY for Lidarr
  lidarr_API_version: { type: String, default: "v1" }, // Lidarr API Version
  lidarr_active: { type: Boolean, default: false }, // Has Lidarr connection been tested and therefore should be included in requests?
  import_blocked: { type: Boolean, default: true }, // Enable or disable automation of handling Starr app files with importBlocked in API queues
  wanted_missing: { type: Boolean, default: true }, // Enable or disable automation of searching for missing and monitored library items
  remove_failed: { type: Boolean, default: true }, // Enable or disable automation of removing failed downloads
  remove_missing: { type: Boolean, default: true }, // Enable or disable automation of removing files from the file system that no longer appear in any Starr app library
  permissions_change: { type: Boolean, default: false }, // Enable or disable automation of changing all directories and files inside Starr app root folders to a user and group
  tidy_directories: { type: Boolean, default: false }, // Enable or disable automation of removing unwanted files in specified directories
  import_blocked_loop: { type: Number, default: 10 }, // Loop timer for importBlocked. Unit = minutes
  wanted_missing_loop: { type: Number, default: 240 }, // Loop timer for wanted missing search. Unit = minutes
  remove_failed_loop: { type: Number, default: 60 }, // Loop timer for remove_failed. Unit = minutes
  remove_missing_loop: { type: Number, default: 60 }, // Loop timer for remove_missing. Unit = minutes
  remove_missing_level: { type: String, default: "Library" }, // The level that which remove missing removes files from the file system. Library = Any file that isn't in Library. Import List = Any file that isn't in Import Lists.
  permissions_change_loop: { type: Number, default: 10 }, // Loop timer for permissions_change. Unit = minutes
  permissions_change_chown: { type: String, default: "" }, // Intended ownership of all content inside Starr app root folders
  permissions_change_chmod: { type: String, default: "" }, // Intended permissions of all content inside Starr app root folders
  tidy_directories_loop: { type: Number, default: 60 }, // Loop timer for tidy_directories. Unit = minutes
  tidy_directories_paths: { type: [tidyDirPathsSchema], default: [] }, // An Array of paths to loop through removing all children that are not allowed. Allowed children are specified in the allowedDirs array.
  qBittorrent_URL: { type: String, default: "" }, // URL including port to reach qBittorrent API
  qBittorrent_username: { type: String, default: "" }, // Username for qBittorrent if it requires credentials
  qBittorrent_password: { type: String, default: "" }, // Password for qBittorrent if it requires credentials
  qBittorrent_active: { type: Boolean, default: false }, // Has qBittorrent connection been tested and therefore should be included in requests?
  qBittorrent_API_version: { type: String, default: "v2" }, // qBittorrent API Version
  created_at: { type: String, default: moment().format() }, // When Settings was created.
  updated_at: { type: String, default: moment().format() }, // When Settings was updated.
})

const Settings = mongoose.model<settingsType>("Settings", settingsSchema)

export default Settings
