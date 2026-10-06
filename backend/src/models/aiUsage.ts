import mongoose from "mongoose"
import moment from "moment"
import { ObjectId } from "mongodb"

// Token and spend totals for a single calendar month of Claude API usage
export type AIUsageType = {
  _id: ObjectId
  month: string // Calendar month in YYYY-MM format
  requests: number // Number of Claude API requests made
  input_tokens: number // Uncached input tokens
  output_tokens: number // Output tokens including any thinking
  cache_read_tokens: number // Input tokens served from the prompt cache
  cache_write_tokens: number // Input tokens written to the prompt cache
  web_searches: number // Web searches run for web lookups
  cost_usd: number // Estimated spend in US dollars
  created_at: string
  updated_at: string
}

const aiUsageSchema = new mongoose.Schema<AIUsageType>({
  month: { type: String, required: true, unique: true },
  requests: { type: Number, default: 0 },
  input_tokens: { type: Number, default: 0 },
  output_tokens: { type: Number, default: 0 },
  cache_read_tokens: { type: Number, default: 0 },
  cache_write_tokens: { type: Number, default: 0 },
  web_searches: { type: Number, default: 0 },
  cost_usd: { type: Number, default: 0 },
  created_at: { type: String, default: () => moment().format() },
  updated_at: { type: String, default: () => moment().format() },
})

const AIUsage = mongoose.model<AIUsageType>("AIUsage", aiUsageSchema)

export default AIUsage
