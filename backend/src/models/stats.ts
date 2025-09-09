import mongoose, { Document } from "mongoose"
import moment from "moment"
import { ObjectId } from "mongodb"

// Individual metric point for time series data
export interface MetricPoint {
  timestamp: string
  count: number
}

// Movie-related metrics
export interface MovieMetrics {
  downloaded: number
  deleted: number
  queued: number
  total_library_size: number
}

// Series-related metrics
export interface SeriesMetrics {
  downloaded: number
  deleted: number
  queued: number
  total_library_size: number
  episodes_downloaded: number
  episodes_deleted: number
}

// Storage metrics in bytes
export interface StorageMetrics {
  total_storage: number
  free_storage: number
  minimum_free_storage: number
  used_percentage: number
  storage_consistency?: 'consistent' | 'inconsistent'
}

// System metrics
export interface SystemMetrics {
  active_users: number
  active_loops: number
  total_downloads: number
  failed_downloads: number
  blocked_downloads: number
}

// Main stats data point collected every hour
export interface StatsDataPoint {
  timestamp: string
  movies: MovieMetrics
  series: SeriesMetrics
  storage: StorageMetrics
  system: SystemMetrics
}

// Main stats type containing time series data
export interface StatsType {
  _id: ObjectId
  data_points: StatsDataPoint[]
  created_at: string
  updated_at: string
}

// Stats object from MongoDB Database
export interface StatsDocType extends StatsType, Document {
  _id: ObjectId
  _doc: StatsType
}

// Movie metrics schema
const movieMetricsSchema = new mongoose.Schema<MovieMetrics>({
  downloaded: { type: Number, default: 0 },
  deleted: { type: Number, default: 0 },
  queued: { type: Number, default: 0 },
  total_library_size: { type: Number, default: 0 },
})

// Series metrics schema
const seriesMetricsSchema = new mongoose.Schema<SeriesMetrics>({
  downloaded: { type: Number, default: 0 },
  deleted: { type: Number, default: 0 },
  queued: { type: Number, default: 0 },
  total_library_size: { type: Number, default: 0 },
  episodes_downloaded: { type: Number, default: 0 },
  episodes_deleted: { type: Number, default: 0 },
})

// Storage metrics schema
const storageMetricsSchema = new mongoose.Schema<StorageMetrics>({
  total_storage: { type: Number, default: 0 },
  free_storage: { type: Number, default: 0 },
  minimum_free_storage: { type: Number, default: 0 },
  used_percentage: { type: Number, default: 0 },
})

// System metrics schema
const systemMetricsSchema = new mongoose.Schema<SystemMetrics>({
  active_users: { type: Number, default: 0 },
  active_loops: { type: Number, default: 0 },
  total_downloads: { type: Number, default: 0 },
  failed_downloads: { type: Number, default: 0 },
  blocked_downloads: { type: Number, default: 0 },
})

// Stats data point schema
const statsDataPointSchema = new mongoose.Schema<StatsDataPoint>({
  timestamp: { type: String, required: true },
  movies: { type: movieMetricsSchema, default: () => ({}) },
  series: { type: seriesMetricsSchema, default: () => ({}) },
  storage: { type: storageMetricsSchema, default: () => ({}) },
  system: { type: systemMetricsSchema, default: () => ({}) },
})

// Main stats schema
const statsSchema = new mongoose.Schema<StatsType>(
  {
    data_points: { type: [statsDataPointSchema], default: [] },
    created_at: { type: String, default: moment().format() },
    updated_at: { type: String, default: moment().format() },
  },
  {
    optimisticConcurrency: true, // Fixes an issue with __v not updating in db on save().
  },
)

// Add index for efficient querying by timestamp
statsSchema.index({ "data_points.timestamp": 1 })

const Stats = mongoose.model<StatsType>("Stats", statsSchema)

export default Stats