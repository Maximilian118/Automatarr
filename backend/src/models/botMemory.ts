import mongoose, { Document } from "mongoose"
import moment from "moment"
import { ObjectId } from "mongodb"

// A single fact the AI has chosen to remember about a user
export type BotMemoryNote = {
  text: string // The remembered fact in plain English
  created_at: string // When the fact was remembered
}

// Per-user controls that change how the AI behaves around this user
export type BotMemoryPreferences = {
  private: boolean // Never mention anything personal about this user in a shared channel
  learning: boolean // Allow the AI to remember new facts and log request habits
  chat: boolean // Allow the AI to chat with this user outside of ! commands
  recommendations: boolean // Allow the AI to send this user unprompted recommendations
}

export type BotMemoryType = {
  _id: ObjectId
  discord_id: string // Discord snowflake ID. Stable even if the user changes their username
  username: string // The last known Discord username for this user
  notes: BotMemoryNote[] // Facts the AI has learnt about this user
  preferences: BotMemoryPreferences // User controlled privacy and interaction preferences
  last_active_at: string | null // The last time this user interacted with the AI or a ! command
  last_recommended_at: string | null // The last time the AI sent this user a recommendation
  last_fallback_notice_at: string | null // The last time this user was told the AI is unavailable
  created_at: string
  updated_at: string
}

export interface BotMemoryDocType extends BotMemoryType, Document {
  _id: ObjectId
}

// Default preferences for a user the AI has not met before
export const initBotMemoryPreferences = (): BotMemoryPreferences => ({
  private: false,
  learning: true,
  chat: true,
  recommendations: true,
})

const noteSchema = new mongoose.Schema<BotMemoryNote>(
  {
    text: { type: String, required: true },
    created_at: { type: String, default: () => moment().format() },
  },
  { _id: false },
)

const preferencesSchema = new mongoose.Schema<BotMemoryPreferences>(
  {
    private: { type: Boolean, default: false },
    learning: { type: Boolean, default: true },
    chat: { type: Boolean, default: true },
    recommendations: { type: Boolean, default: true },
  },
  { _id: false },
)

const botMemorySchema = new mongoose.Schema<BotMemoryType>({
  discord_id: { type: String, required: true, unique: true },
  username: { type: String, required: true },
  notes: { type: [noteSchema], default: [] },
  preferences: { type: preferencesSchema, default: initBotMemoryPreferences },
  last_active_at: { type: String, default: null },
  last_recommended_at: { type: String, default: null },
  last_fallback_notice_at: { type: String, default: null },
  created_at: { type: String, default: () => moment().format() },
  updated_at: { type: String, default: () => moment().format() },
})

const BotMemory = mongoose.model<BotMemoryType>("BotMemory", botMemorySchema)

export default BotMemory
