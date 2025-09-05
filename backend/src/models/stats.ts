import mongoose, { Document } from "mongoose"
import moment from "moment"
import { ObjectId } from "mongodb"

export interface MediaCount {
  movies: number
  series: number
  episodes: number
}

export interface StatsSnapshot {
  timestamp: string
  downloaded: MediaCount
  deleted: MediaCount
  diskUsage: number
  activeDownloads: number
  queuedDownloads: number
  failedDownloads: number
  totalBandwidth: number
}

export interface HourlyStats {
  hour: string
  downloaded: MediaCount
  deleted: MediaCount
  averageDiskUsage: number
  averageBandwidth: number
  peakActiveDownloads: number
}

export interface statsType {
  _id: ObjectId
  currentSnapshot: StatsSnapshot
  hourlyStats: HourlyStats[]
  dailyStats: HourlyStats[]
  created_at: string
  updated_at: string
  [key: string]: any
}

export interface statsDocType extends statsType, Document {
  _id: ObjectId
  _doc: statsType
}

const mediaCountSchema = new mongoose.Schema<MediaCount>({
  movies: { type: Number, default: 0 },
  series: { type: Number, default: 0 },
  episodes: { type: Number, default: 0 },
})

const statsSnapshotSchema = new mongoose.Schema<StatsSnapshot>({
  timestamp: { type: String, default: moment().format() },
  downloaded: { type: mediaCountSchema, default: () => ({}) },
  deleted: { type: mediaCountSchema, default: () => ({}) },
  diskUsage: { type: Number, default: 0 },
  activeDownloads: { type: Number, default: 0 },
  queuedDownloads: { type: Number, default: 0 },
  failedDownloads: { type: Number, default: 0 },
  totalBandwidth: { type: Number, default: 0 },
})

const hourlyStatsSchema = new mongoose.Schema<HourlyStats>({
  hour: { type: String, required: true },
  downloaded: { type: mediaCountSchema, default: () => ({}) },
  deleted: { type: mediaCountSchema, default: () => ({}) },
  averageDiskUsage: { type: Number, default: 0 },
  averageBandwidth: { type: Number, default: 0 },
  peakActiveDownloads: { type: Number, default: 0 },
})

const statsSchema = new mongoose.Schema<statsType>({
  currentSnapshot: { type: statsSnapshotSchema, default: () => ({}) },
  hourlyStats: { type: [hourlyStatsSchema], default: [] },
  dailyStats: { type: [hourlyStatsSchema], default: [] },
  created_at: { type: String, default: moment().format() },
  updated_at: { type: String, default: moment().format() },
})

// Add indexes for efficient querying
statsSchema.index({ "currentSnapshot.timestamp": -1 })
statsSchema.index({ "hourlyStats.hour": -1 })
statsSchema.index({ updated_at: -1 })

// Enable optimistic concurrency control
statsSchema.set("optimisticConcurrency", true)

const Stats = mongoose.model<statsType>("Stats", statsSchema)
export default Stats