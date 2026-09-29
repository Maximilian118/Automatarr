import { Message } from "discord.js"
import Settings, { settingsDocType } from "../../../models/settings"
import { sendDiscordMessage } from "../discordBotUtility"
import { randomRateLimitedMessage } from "../discordBotRandomReply"
import { commandUsageHelp } from "../cases/discordBotcaseHelp"
import { channelValid } from "../validate/validationUtility"
import { aiConfigured } from "./aiClient"
import { claimLimitNotice } from "./aiBudget"
import { isAICommandMessage } from "./aiCommandMessage"
import { reducedCapabilitiesNotice } from "./aiFallback"
import { gateMessage } from "./aiGate"
import { respondWithAI } from "./aiResponder"
import { recordUserMessage } from "./aiContext"
import { touchActivity } from "./aiMemory"
import { checkReturningUser } from "./aiRecommendationTriggers"
import logger from "../../../logger"

// Note a ! command in the user's exchange so they can chat about it afterwards,
// and mark them as active for recommendations. Only touches the database when the AI is on.
export const noteCommandActivity = async (message: Message): Promise<void> => {
  recordUserMessage(message.channel.id, message.author.id, message.content)

  try {
    const settings = (await Settings.findOne()) as settingsDocType | null
    if (settings && aiConfigured(settings.ai_bot)) {
      const identity = { id: message.author.id, username: message.author.username }
      checkReturningUser(identity, await touchActivity(identity))
    }
  } catch (err) {
    logger.error(`AI Bot | Failed to note command activity: ${err}`)
  }
}

// Handle a message that isn't a ! command. Costs nothing unless the gate decides to engage.
export const handleAIMessage = async (message: Message): Promise<void> => {
  const settings = (await Settings.findOne()) as settingsDocType | null
  if (!settings || !aiConfigured(settings.ai_bot)) return

  const reason = await gateMessage(message, settings)
  if (!reason) return

  const result = await respondWithAI(message, settings, reason)

  // Tell rate limited users once per limit, then stay silent until it clears
  if (result === "limited" && reason !== "passing" && claimLimitNotice(message.author.id)) {
    await sendDiscordMessage(message, randomRateLimitedMessage())
  }

  // Tell the user once in a while that the AI is down
  if (result === "unavailable" && reason !== "passing") {
    const notice = await reducedCapabilitiesNotice(
      { id: message.author.id, username: message.author.username },
      "Claude API unavailable or monthly budget reached.",
    )
    await sendDiscordMessage(message, notice)
  }
}

// Decide what to do with a ! command that failed validation or doesn't exist.
// Wrong-channel errors and AI-built commands keep the legacy reply. Everything else goes to the AI
// when it's available, which either runs the corrected command or explains how to type it.
// Returns the legacy reply to send, or an empty string when the AI has handled it.
export const resolveInvalidCommand = async (
  message: Message,
  legacyReply: string,
  unknownCommand: boolean = false, // Unknown commands aren't tied to a channel, so skip the channel check
): Promise<string> => {
  if (!legacyReply || isAICommandMessage(message)) return legacyReply

  const settings = (await Settings.findOne()) as settingsDocType | null
  if (!settings || !aiConfigured(settings.ai_bot) || !settings.ai_bot.command_help) return legacyReply

  // Wrong-channel replies already point to the right channel, so the AI isn't needed
  if (!unknownCommand && typeof channelValid(message.channel, settings) === "string") return legacyReply

  const typedCommand = message.content.trim().split(/\s+/)[0]
  const result = await respondWithAI(message, settings, "command_help", {
    typed: message.content,
    error: legacyReply,
    usage: commandUsageHelp(typedCommand),
  })

  if (result === "handled") return ""
  if (result === "limited") return legacyReply

  const notice = await reducedCapabilitiesNotice(
    { id: message.author.id, username: message.author.username },
    "Claude API unavailable or monthly budget reached.",
  )

  return notice ? `${legacyReply}\n\n${notice}` : legacyReply
}
