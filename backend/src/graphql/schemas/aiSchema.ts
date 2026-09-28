const aiSchema = `
  type AIModel {
    id: String!
    label: String!
    inputPerM: Float!
    outputPerM: Float!
  }

  type AIModelsReturn {
    data: [AIModel!]!
    tokens: [String!]!
  }

  type AIUsage {
    month: String!
    requests: Int!
    input_tokens: Int!
    output_tokens: Int!
    cache_read_tokens: Int!
    cache_write_tokens: Int!
    cost_usd: Float!
  }

  type AIUsageReturn {
    data: AIUsage!
    tokens: [String!]!
  }

  type BotMemoryNote {
    text: String!
    created_at: String!
  }

  type BotMemoryPreferences {
    private: Boolean!
    learning: Boolean!
    chat: Boolean!
    recommendations: Boolean!
  }

  type BotMemory {
    discord_id: String!
    username: String!
    notes: [BotMemoryNote!]!
    preferences: BotMemoryPreferences!
    last_active_at: String
    last_recommended_at: String
  }

  type BotMemoriesReturn {
    data: [BotMemory!]!
    tokens: [String!]!
  }
`
export default aiSchema
