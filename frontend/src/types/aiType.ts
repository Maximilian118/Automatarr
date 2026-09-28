// A Claude model selectable for the AI bot
export type AIModel = {
  id: string
  label: string
  inputPerM: number // USD per million input tokens
  outputPerM: number // USD per million output tokens
}

// Token and estimated spend totals for a calendar month
export type AIUsage = {
  month: string
  requests: number
  input_tokens: number
  output_tokens: number
  cache_read_tokens: number
  cache_write_tokens: number
  cost_usd: number
}

// Per-user controls for how the AI behaves around a Discord user
export type BotMemoryPreferences = {
  private: boolean
  learning: boolean
  chat: boolean
  recommendations: boolean
}

// Everything the AI remembers about a Discord user
export type BotMemory = {
  discord_id: string
  username: string
  notes: { text: string; created_at: string }[]
  preferences: BotMemoryPreferences
  last_active_at: string | null
  last_recommended_at: string | null
}
