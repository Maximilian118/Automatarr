import Anthropic from "@anthropic-ai/sdk"
import moment from "moment"
import AIUsage, { AIUsageType } from "../../../models/aiUsage"
import { AIBotType } from "../../../models/settings"
import logger from "../../../logger"
import { getModelConfig, priceUsage } from "./aiClient"

// Maximum AI engagements a single user can trigger per hour. High enough that only abuse reaches it.
const USER_HOURLY_CAP = 60

// Maximum AI engagements a single user can trigger within the burst window, to stop spam
const USER_BURST_CAP = 8
const BURST_WINDOW_MS = 60 * 1000

// Rough upper bound for the cost of one engagement, used to derive the daily global cap
const EST_ENGAGEMENT_TOKENS = { input: 4500, output: 150 }

// A busy day may use up to this many days' share of the monthly budget
const BUSY_DAY_MULTIPLIER = 5

// Recent engagement timestamps per Discord user ID
const userEngagements = new Map<string, number[]>()

// Engagement timestamps across all users for the daily cap
let globalEngagements: number[] = []

// Users who have already been told they're rate limited during their current limit
const limitNoticed = new Set<string>()

// The current calendar month key used for usage documents
const currentMonth = (): string => moment().format("YYYY-MM")

// Get this month's usage document, creating it if needed
export const getMonthlyUsage = async (): Promise<AIUsageType> => {
  const month = currentMonth()
  const usage = await AIUsage.findOneAndUpdate(
    { month },
    { $setOnInsert: { month } },
    { upsert: true, new: true },
  )

  return usage.toObject()
}

// Add the tokens and estimated cost of a response to this month's totals
export const recordUsage = async (modelId: string, usage: Anthropic.Beta.BetaUsage): Promise<void> => {
  const cost = priceUsage(modelId, usage)

  try {
    await AIUsage.findOneAndUpdate(
      { month: currentMonth() },
      {
        $inc: {
          requests: 1,
          input_tokens: usage.input_tokens ?? 0,
          output_tokens: usage.output_tokens ?? 0,
          cache_read_tokens: usage.cache_read_input_tokens ?? 0,
          cache_write_tokens: usage.cache_creation_input_tokens ?? 0,
          cost_usd: cost,
        },
        $set: { updated_at: moment().format() },
      },
      { upsert: true },
    )
  } catch (err) {
    logger.error(`AI Bot | Failed to record usage: ${err}`)
  }
}

// Check whether this month's estimated spend has reached the configured budget
export const budgetExhausted = async (aiBot: AIBotType): Promise<boolean> => {
  const usage = await getMonthlyUsage()
  return usage.cost_usd >= aiBot.monthly_budget
}

// Derive how many engagements per day the budget can afford for the selected model
const dailyGlobalCap = (aiBot: AIBotType): number => {
  const model = getModelConfig(aiBot.model)
  const perEngagement =
    (EST_ENGAGEMENT_TOKENS.input * model.inputPerM + EST_ENGAGEMENT_TOKENS.output * model.outputPerM) /
    1_000_000
  const daysInMonth = moment().daysInMonth()

  return Math.max(1, Math.floor((aiBot.monthly_budget / daysInMonth / perEngagement) * BUSY_DAY_MULTIPLIER))
}

// Drop timestamps older than the given window
const withinWindow = (timestamps: number[], windowMs: number): number[] => {
  const cutoff = Date.now() - windowMs
  return timestamps.filter((t) => t > cutoff)
}

// Check whether a user may trigger another AI engagement right now. Admins are never limited.
export const rateLimited = (aiBot: AIBotType, discordId: string, isAdmin: boolean): boolean => {
  if (isAdmin) return false

  const hourMs = 60 * 60 * 1000
  const dayMs = 24 * hourMs

  const userRecent = withinWindow(userEngagements.get(discordId) ?? [], hourMs)
  userEngagements.set(discordId, userRecent)
  globalEngagements = withinWindow(globalEngagements, dayMs)

  const limited =
    userRecent.length >= USER_HOURLY_CAP ||
    withinWindow(userRecent, BURST_WINDOW_MS).length >= USER_BURST_CAP ||
    globalEngagements.length >= dailyGlobalCap(aiBot)

  if (!limited) limitNoticed.delete(discordId)

  return limited
}

// Claim the one rate limit notice a user gets per limit. True only the first time.
export const claimLimitNotice = (discordId: string): boolean => {
  if (limitNoticed.has(discordId)) return false

  limitNoticed.add(discordId)
  return true
}

// Record that a user has triggered an AI engagement
export const noteEngagement = (discordId: string): void => {
  const recent = userEngagements.get(discordId) ?? []
  recent.push(Date.now())
  userEngagements.set(discordId, recent)
  globalEngagements.push(Date.now())
}
