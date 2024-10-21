import mongoose from "mongoose"
import moment from "moment"
import { ObjectId } from "mongodb"

export interface statsType {
  _id: ObjectId
  radarr_total: number
  radarr_queue: number
  radarr_missing: number
  sonarr_total: number
  sonarr_queue: number
  sonarr_missing: number
  lidarr_total: number
  lidarr_queue: number
  lidarr_missing: number
  created_at: string
  updated_at: string
  _doc: statsType
}

const statsSchema = new mongoose.Schema<statsType>({
  radarr_total: { type: Number, default: 0 }, // The total of library items in Radarr
  radarr_queue: { type: Number, default: 0 }, // The total of items in the Radarr queue
  radarr_missing: { type: Number, default: 0 }, // The total of Radarr itmes in the Wanted Missing tab
  sonarr_total: { type: Number, default: 0 }, // The total of library items in Sonarr
  sonarr_queue: { type: Number, default: 0 }, // The total of items in the Sonarr queue
  sonarr_missing: { type: Number, default: 0 }, // The total of Sonarr itmes in the Wanted Missing tab
  lidarr_total: { type: Number, default: 0 }, // The total of library items in Lidarr
  lidarr_queue: { type: Number, default: 0 }, // The total of items in the Lidarr queue
  lidarr_missing: { type: Number, default: 0 }, // The total of Lidarr itmes in the Wanted Missing tab
  created_at: { type: String, default: moment().format() }, // When Stats was created.
  updated_at: { type: String, default: moment().format() }, // When Stats was updated.
})

const Stats = mongoose.model<statsType>("Stats", statsSchema)

export default Stats
