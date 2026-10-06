import { Message } from "discord.js"
import Settings, { settingsDocType } from "../../../models/settings"
import { resolveMentions, sendDiscordMessage } from "../discordBotUtility"
import { randomRateLimitedMessage } from "../discordBotRandomReply"
import { commandUsageHelp } from "../cases/discordBotcaseHelp"
import { channelValid } from "../validate/validationUtility"
import { aiConfigured } from "./aiClient"
import { claimLimitNotice } from "./aiBudget"
import { isAICommandMessage } from "./aiCommandMessage"
import { reducedCapabilitiesNotice } from "./aiFallback"
import { EngageReason, gateMessage } from "./aiGate"
import { respondWithAI } from "./aiResponder"
import { recordAside, recordUserMessage } from "./aiContext"
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

// Reply to a message with the AI, sending a notice if the user is rate limited or the AI is down
const respondAndNotify = async (message: Message, settings: settingsDocType, reason: EngageReason): Promise<void> => {
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

// A message that passed the gate while the bot was still replying to the same person in the same channel
type QueuedMessage = { message: Message; reason: EngageReason }

// Engagements in progress, keyed by channel and user, with any messages that arrived meanwhile.
// Stops two quick messages getting two replies built from the same out-of-date history.
const inProgress = new Map<string, QueuedMessage[]>()

// Respond to one message, then to anything the same person said while that reply was being written.
// Messages that piled up are answered together: earlier ones go into the history, the last is replied to.
const respondInTurn = async (message: Message, settings: settingsDocType, reason: EngageReason): Promise<void> => {
  const key = `${message.channel.id}:${message.author.id}`
  inProgress.set(key, [])

  try {
    let next: QueuedMessage | undefined = { message, reason }

    while (next) {
      await respondAndNotify(next.message, settings, next.reason)

      const queued: QueuedMessage[] = inProgress.get(key) ?? []
      inProgress.set(key, [])
      queued.slice(0, -1).forEach((q) => recordUserMessage(q.message.channel.id, q.message.author.id, resolveMentions(q.message)))
      next = queued[queued.length - 1]
    }
  } finally {
    inProgress.delete(key)
  }
}

// Handle a message that isn't a ! command. Costs nothing unless the gate decides to engage.
export const handleAIMessage = async (message: Message): Promise<void> => {
  const settings = (await Settings.findOne()) as settingsDocType | null
  if (!settings || !aiConfigured(settings.ai_bot)) return

  const reason = await gateMessage(message, settings)
  if (!reason) {
    if (!message.author.bot && message.content.trim()) {
      recordAside(message.channel.id, message.author.id, resolveMentions(message))
    }
    return
  }

  const queue = inProgress.get(`${message.channel.id}:${message.author.id}`)
  if (queue) {
    queue.push({ message, reason })
    return
  }

  await respondInTurn(message, settings, reason)
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
