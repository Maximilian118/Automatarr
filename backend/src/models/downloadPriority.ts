import mongoose from "mongoose"
import moment from "moment"
import { ObjectId } from "mongodb"

export type PriorityContentType = "movie" | "series"

// A download a Discord user started. While it exists, its jobs are kept at the
// front of the SABnzbd/qBittorrent queues in priority order.
export type DownloadPriorityType = {
  _id: ObjectId
  content_type: PriorityContentType
  starr_id: number // Radarr movieId or Sonarr seriesId. Matched against Starr queue records
  title: string
  discord_id: string // Discord snowflake ID of the requester
  name: string // Display name of the requester, used when telling other users about the queue
  requested_at: string
  activated_at: string | null // When the first job for this request appeared in a Starr queue
  empty_ticks: number // Consecutive passes with no jobs in the Starr queue after activation
}

const downloadPrioritySchema = new mongoose.Schema<DownloadPriorityType>({
  content_type: { type: String, required: true },
  starr_id: { type: Number, required: true },
  title: { type: String, required: true },
  discord_id: { type: String, required: true },
  name: { type: String, required: true },
  requested_at: { type: String, default: () => moment().format() },
  activated_at: { type: String, default: null },
  empty_ticks: { type: Number, default: 0 },
})

downloadPrioritySchema.index({ content_type: 1, starr_id: 1 }, { unique: true })

const DownloadPriority = mongoose.model<DownloadPriorityType>(
  "DownloadPriority",
  downloadPrioritySchema,
)

export default DownloadPriority
