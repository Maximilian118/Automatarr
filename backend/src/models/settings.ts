import mongoose from "mongoose"
import moment from "moment"
import { ObjectId } from "mongodb"

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
  import_blocked_loop: number
  wanted_missing_loop: number
  qBittorrent_URL: string
  qBittorrent_username: string
  qBittorrent_password: string
  qBittorrent_active: boolean
  created_at: string
  updated_at: string
  _doc: settingsType
  [key: string]: any
}

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
  import_blocked: { type: Boolean, default: true }, // Enable or disable automation of files with importBlocked in queue
  wanted_missing: { type: Boolean, default: true }, // Enable or disable automation of searching for missing and monitored library items
  import_blocked_loop: { type: Number, default: 10 }, // Loop timer for importBlocked
  wanted_missing_loop: { type: Number, default: 240 }, // Loop timer for wanted missing search
  qBittorrent_URL: { type: String, default: "" }, // URL including port to reach qBittorrent API
  qBittorrent_username: { type: String, default: "" }, // Username for qBittorrent if it requires credentials
  qBittorrent_password: { type: String, default: "" }, // Password for qBittorrent if it requires credentials
  qBittorrent_active: { type: Boolean, default: false }, // Has qBittorrent connection been tested and therefore should be included in requests?
  created_at: { type: String, default: moment().format() }, // When Settings was created.
  updated_at: { type: String, default: moment().format() }, // When Settings was updated.
})

const Settings = mongoose.model<settingsType>("Settings", settingsSchema)

export default Settings
