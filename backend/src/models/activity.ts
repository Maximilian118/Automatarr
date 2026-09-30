import mongoose from "mongoose"
import { ObjectId } from "mongodb"

// The kinds of removal Automatarr can record
export const activityActions = [
  "file",
  "folder",
  "library",
  "torrent",
  "queue",
  "movie_file",
  "episode_file",
] as const

export type ActivityAction = (typeof activityActions)[number]

// A single record of something Automatarr removed. Written after the removal succeeded.
export type ActivityType = {
  _id: ObjectId
  at: Date // When the removal happened
  source: string // What removed it, e.g. a loop name, "discord" or "manual"
  action: ActivityAction // What kind of thing was removed
  app?: string // The app it was removed from, e.g. Radarr, Sonarr or qBittorrent
  title: string // A human readable name for what was removed
  path?: string // The file system path, if it was a file or folder
  bytes?: number // The size of what was removed, if known
  reason?: string // Why it was removed, if known
}

// Days to keep activity records before MongoDB expires them automatically
const activityRetentionDays = 90

const activitySchema = new mongoose.Schema<ActivityType>({
  at: { type: Date, default: Date.now },
  source: { type: String, required: true },
  action: { type: String, enum: activityActions, required: true },
  app: { type: String },
  title: { type: String, required: true },
  path: { type: String },
  bytes: { type: Number },
  reason: { type: String },
})

// Newest-first reads, filtered reads by source, and automatic expiry after the retention period
activitySchema.index({ at: -1 })
activitySchema.index({ source: 1, at: -1 })
activitySchema.index({ at: 1 }, { expireAfterSeconds: activityRetentionDays * 24 * 60 * 60 })

const Activity = mongoose.model<ActivityType>("Activity", activitySchema)

export default Activity
