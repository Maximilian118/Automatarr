import mongoose from "mongoose"
import moment from "moment"
import { ObjectId } from "mongodb"

export interface statsType {
  _id: ObjectId
  Radarr_total: number
  Radarr_queue: number
  Radarr_missing: number
  Sonarr_total: number
  Sonarr_queue: number
  Sonarr_missing: number
  Lidarr_total: number
  Lidarr_queue: number
  Lidarr_missing: number
  created_at: string
  updated_at: string
  _doc: statsType
}

const statsSchema = new mongoose.Schema<statsType>({
  Radarr_total: { type: Number, default: 0 }, // The total of library items in Radarr
  Radarr_queue: { type: Number, default: 0 }, // The total of items in the Radarr queue
  Radarr_missing: { type: Number, default: 0 }, // The total of Radarr itmes in the Wanted Missing tab
  Sonarr_total: { type: Number, default: 0 }, // The total of library items in Sonarr
  Sonarr_queue: { type: Number, default: 0 }, // The total of items in the Sonarr queue
  Sonarr_missing: { type: Number, default: 0 }, // The total of Sonarr itmes in the Wanted Missing tab
  Lidarr_total: { type: Number, default: 0 }, // The total of library items in Lidarr
  Lidarr_queue: { type: Number, default: 0 }, // The total of items in the Lidarr queue
  Lidarr_missing: { type: Number, default: 0 }, // The total of Lidarr itmes in the Wanted Missing tab
  created_at: { type: String, default: moment().format() }, // When Stats was created.
  updated_at: { type: String, default: moment().format() }, // When Stats was updated.
})

const Stats = mongoose.model<statsType>("Stats", statsSchema)

export default Stats
