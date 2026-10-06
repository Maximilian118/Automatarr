import Anthropic from "@anthropic-ai/sdk"
import { AIBotType } from "../../../models/settings"

// Everything the responder needs to know about a selectable Claude model
export type AIModelConfig = {
  id: string // Claude model ID sent to the API
  label: string // Display name shown in the frontend dropdown
  inputPerM: number // USD per million uncached input tokens
  outputPerM: number // USD per million output tokens
  thinking: boolean // Use adaptive thinking at low effort
  cacheable: boolean // The static prompt is long enough to be cached on this model
  fallbacks: boolean // Enable server-side refusal fallbacks
  maxTokens: number // Output ceiling per request, including any thinking
}

// Selectable models, cheapest first. Haiku is the default because it fits a small monthly budget.
export const AI_MODELS: AIModelConfig[] = [
  {
    id: "claude-haiku-4-5",
    label: "Claude Haiku 4.5",
    inputPerM: 1,
    outputPerM: 5,
    thinking: false,
    cacheable: true, // Haiku 4.5 only caches a prefix of 4096+ tokens. Shorter prefixes just aren't cached, at no cost.
    fallbacks: false,
    maxTokens: 500,
  },
  {
    id: "claude-sonnet-5",
    label: "Claude Sonnet 5",
    inputPerM: 2,
    outputPerM: 10,
    thinking: true,
    cacheable: true,
    fallbacks: false,
    maxTokens: 1024,
  },
  {
    id: "claude-opus-5",
    label: "Claude Opus 5",
    inputPerM: 5,
    outputPerM: 25,
    thinking: true,
    cacheable: true,
    fallbacks: true,
    maxTokens: 1024,
  },
]

// Beta header for server-side refusal fallbacks
export const FALLBACK_BETA = "server-side-fallback-2026-07-01"

// USD charged per web search, on top of the tokens its results add
export const WEB_SEARCH_PRICE = 0.01

// Cache write and read multipliers relative to the base input price
const CACHE_WRITE_MULTIPLIER = 1.25
const CACHE_READ_MULTIPLIER = 0.1

// Find the config for a model ID, defaulting to the cheapest model
export const getModelConfig = (modelId: string): AIModelConfig =>
  AI_MODELS.find((m) => m.id === modelId) ?? AI_MODELS[0]

// Estimate the USD cost of a single response from its usage block
export const priceUsage = (modelId: string, usage: Anthropic.Beta.BetaUsage): number => {
  const model = getModelConfig(modelId)
  const input = usage.input_tokens ?? 0
  const output = usage.output_tokens ?? 0
  const cacheWrite = usage.cache_creation_input_tokens ?? 0
  const cacheRead = usage.cache_read_input_tokens ?? 0
  const searches = usage.server_tool_use?.web_search_requests ?? 0

  return (
    searches * WEB_SEARCH_PRICE +
    (input * model.inputPerM +
      cacheWrite * model.inputPerM * CACHE_WRITE_MULTIPLIER +
      cacheRead * model.inputPerM * CACHE_READ_MULTIPLIER +
      output * model.outputPerM) /
    1_000_000
  )
}

// Reuse one client per API key so connections are pooled
let cachedClient: { key: string; client: Anthropic } | null = null

// Get an Anthropic client for the configured API key
export const getAIClient = (aiBot: AIBotType): Anthropic => {
  if (cachedClient && cachedClient.key === aiBot.api_key) return cachedClient.client

  const client = new Anthropic({
    apiKey: aiBot.api_key,
    timeout: 30_000, // Chat replies should be quick. Fail fast and fall back instead.
    maxRetries: 1,
  })

  cachedClient = { key: aiBot.api_key, client }
  return client
}

// Check an Anthropic API key works. Listing models is free, so this costs nothing.
// Returns an HTTP style status code and, on failure, a reason the user can act on.
export const checkAIKey = async (apiKey: string): Promise<{ status: number; message: string }> => {
  try {
    await new Anthropic({ apiKey, timeout: 10_000, maxRetries: 0 }).models.list({ limit: 1 })
    return { status: 200, message: "" }
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) {
      return { status: 401, message: "Anthropic rejected this API key. Check it was copied in full." }
    }
    if (err instanceof Anthropic.APIError) {
      const reason = /credit balance/i.test(err.message)
        ? "Your Anthropic account has no credit. Add some under Billing at console.anthropic.com."
        : err.message
      return { status: err.status ?? 500, message: reason }
    }
    return { status: 500, message: "Couldn't reach the Anthropic API from the server." }
  }
}

// Check the AI layer is switched on and has everything it needs to run
export const aiConfigured = (aiBot: AIBotType | undefined): aiBot is AIBotType =>
  !!aiBot && aiBot.active && !!aiBot.api_key
