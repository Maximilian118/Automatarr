import Anthropic from "@anthropic-ai/sdk"
import moment from "moment"
import logger from "../../../logger"
import { randomReducedCapabilitiesMessage } from "../discordBotRandomReply"
import { DiscordIdentity, getMemory, stampMemory } from "./aiMemory"

// How often a single user is told the AI is unavailable
const NOTICE_COOLDOWN_HOURS = 6

// Describe why a Claude API request failed, for the logs
export const describeAIError = (err: unknown): string => {
  if (err instanceof Anthropic.AuthenticationError) return "Invalid API key."
  if (err instanceof Anthropic.PermissionDeniedError) return "API key lacks permission."
  if (err instanceof Anthropic.RateLimitError) return "Rate limited by the Claude API."
  if (err instanceof Anthropic.BadRequestError) {
    return /credit balance/i.test(err.message) ? "Out of Claude API credit." : `Bad request: ${err.message}`
  }
  if (err instanceof Anthropic.InternalServerError) return "Claude API is overloaded or erroring."
  if (err instanceof Anthropic.APIConnectionTimeoutError) return "Claude API request timed out."
  if (err instanceof Anthropic.APIConnectionError) return "Could not reach the Claude API."
  if (err instanceof Anthropic.APIError) return `Claude API error ${err.status}: ${err.message}`

  return err instanceof Error ? err.message : String(err)
}

// Decide whether to tell a user the AI is unavailable. Throttled so nobody gets spammed.
// Returns the notice to send, or an empty string when the user was told recently.
export const reducedCapabilitiesNotice = async (
  identity: DiscordIdentity,
  reason: string,
): Promise<string> => {
  logger.warn(`AI Bot | Reduced capabilities for ${identity.username}: ${reason}`)

  try {
    const memory = await getMemory(identity)
    const last = memory.last_fallback_notice_at

    if (last && moment().diff(moment(last), "hours") < NOTICE_COOLDOWN_HOURS) return ""

    await stampMemory(identity.id, "last_fallback_notice_at")
  } catch (err) {
    logger.error(`AI Bot | Failed to check fallback notice cooldown: ${err}`)
  }

  return randomReducedCapabilitiesMessage()
}
