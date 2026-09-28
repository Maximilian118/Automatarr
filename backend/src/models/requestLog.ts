import mongoose from "mongoose"
import moment from "moment"
import { ObjectId } from "mongodb"

export type RequestLogAction = "download" | "readd" | "remove"

// An append-only record of content a Discord user has requested or removed.
// User pools only hold current state, so this is where request habits come from.
export type RequestLogType = {
  _id: ObjectId
  discord_id: string // Discord snowflake ID of the requester
  username: string // Discord username at the time of the request
  content_type: "movie" | "series"
  title: string
  year: number
  tmdbId: number | null
  tvdbId: number | null
  genres: string[]
  action: RequestLogAction
  created_at: string
}

const requestLogSchema = new mongoose.Schema<RequestLogType>({
  discord_id: { type: String, required: true, index: true },
  username: { type: String, required: true },
  content_type: { type: String, required: true },
  title: { type: String, required: true },
  year: { type: Number, default: 0 },
  tmdbId: { type: Number, default: null },
  tvdbId: { type: Number, default: null },
  genres: { type: [String], default: [] },
  action: { type: String, required: true },
  created_at: { type: String, default: () => moment().format() },
})

const RequestLog = mongoose.model<RequestLogType>("RequestLog", requestLogSchema)

export default RequestLog
