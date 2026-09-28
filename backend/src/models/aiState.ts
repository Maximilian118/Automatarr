import mongoose from "mongoose"
import moment from "moment"
import { ObjectId } from "mongodb"

// Something that just finished downloading and is waiting to be considered for a recommendation
export type PendingArrival = {
  content_type: "movie" | "series"
  library_id: number // Radarr movie ID or Sonarr series ID
  arrived_at: string
}

// Server-wide state for the AI bot
export type AIStateType = {
  _id: ObjectId
  next_recommendation_at: string | null // No recommendation is sent before this. Null = allowed now
  pending_arrivals: PendingArrival[] // New arrivals waiting for a suitable recipient and sociable hours
  created_at: string
  updated_at: string
}

const pendingArrivalSchema = new mongoose.Schema<PendingArrival>(
  {
    content_type: { type: String, required: true },
    library_id: { type: Number, required: true },
    arrived_at: { type: String, default: () => moment().format() },
  },
  { _id: false },
)

const aiStateSchema = new mongoose.Schema<AIStateType>({
  next_recommendation_at: { type: String, default: null },
  pending_arrivals: { type: [pendingArrivalSchema], default: [] },
  created_at: { type: String, default: () => moment().format() },
  updated_at: { type: String, default: () => moment().format() },
})

const AIState = mongoose.model<AIStateType>("AIState", aiStateSchema)

export default AIState
