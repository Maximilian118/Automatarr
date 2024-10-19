import mongoose from "mongoose"
import moment from "moment"
import { ObjectId } from "mongodb"

export interface settingsType {
  _id: ObjectId
  Radarr_URL: string
  Radarr_KEY: string
  Sonarr_URL: string
  Sonarr_KEY: string
  Lidarr_URL: string
  Lidarr_KEY: string
  Import_Blocked: boolean
  Wanted_Missing: boolean
  Import_Blocked_Loop: number
  Wanted_Missing_Loop: number
  qBittorrent_URL: string
  created_at: string
  updated_at: string
  _doc: settingsType
}

const settingsSchema = new mongoose.Schema<settingsType>({
  Radarr_URL: { type: String, default: "" }, // URL including port to reach Radarr API
  Radarr_KEY: { type: String, default: "" }, // API KEY for Radarr
  Sonarr_URL: { type: String, default: "" }, // URL including port to reach Sonarr API
  Sonarr_KEY: { type: String, default: "" }, // API KEY for Sonarr
  Lidarr_URL: { type: String, default: "" }, // URL including port to reach Lidarr API
  Lidarr_KEY: { type: String, default: "" }, // API KEY for Lidarr
  Import_Blocked: { type: Boolean, default: true }, // Enable or disable automation of files with importBlocked in queue
  Wanted_Missing: { type: Boolean, default: true }, // Enable or disable automation of searching for missing and monitored library items
  Import_Blocked_Loop: { type: Number, default: 10 }, // Loop timer for importBlocked
  Wanted_Missing_Loop: { type: Number, default: 240 }, // Loop timer for wanted missing search
  qBittorrent_URL: { type: String, default: "" }, // URL including port to reach qBittorrent API
  created_at: { type: String, default: moment().format() }, // When Settings was created.
  updated_at: { type: String, default: moment().format() }, // When Settings was updated.
})

const Settings = mongoose.model<settingsType>("Settings", settingsSchema)

export default Settings
