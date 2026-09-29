import { Message } from "discord.js"
import logger from "../../../logger"
import { settingsDocType } from "../../../models/settings"
import { endConversation, inConversation } from "./aiContext"
import { getPreferences } from "./aiMemory"

// Why the AI decided to engage with a message
// direct = the bot was addressed, conversation = an active back-and-forth, passing = name mentioned in passing
export type EngageReason = "direct" | "conversation" | "passing"

// Names the bot answers to, lowercased
const botNames = (message: Message): string[] =>
  ["automatarr", message.client.user?.username.toLowerCase() ?? ""].filter(Boolean)

// Strip punctuation and emoji from a word so "automatarr," and "automatarr!" still match
const cleanWord = (word: string): string => word.toLowerCase().replace(/[^a-z0-9]/g, "")

// Split a message into words
const messageWords = (message: Message): string[] => message.content.trim().split(/\s+/)

// Find where the bot's name appears in a message. Returns -1 if it doesn't.
const nameIndex = (message: Message, words: string[]): number => {
  const names = botNames(message)
  return words.findIndex((w) => names.includes(cleanWord(w)))
}

// IDs of the humans mentioned in a message, other than the author
const mentionedHumanIds = (message: Message): string[] =>
  message.mentions.users.filter((u) => !u.bot && u.id !== message.author.id).map((u) => u.id)

// Find where the first human mention appears in a message. Returns -1 if there isn't one.
const humanMentionIndex = (message: Message, words: string[]): number => {
  const ids = mentionedHumanIds(message)
  if (!ids.length) return -1

  return words.findIndex((w) => {
    const match = w.match(/<@!?(\d+)>/)
    return !!match && ids.includes(match[1])
  })
}

// Whether a human mention opens the message, e.g. "@Tanox look at this", which addresses that human
const opensByAddressingHuman = (message: Message, words: string[]): boolean => {
  const idx = humanMentionIndex(message, words)
  return idx !== -1 && idx <= 1
}

// Check whether the bot's name is used as a form of address,
// e.g. "Automatarr, grab me X" or "thanks automatarr", rather than talked about mid-sentence.
// A message that opens by addressing a human ("@Tanox automatarr's alive") is talking about the bot, not to it.
const nameUsedAsAddress = (message: Message): boolean => {
  const words = messageWords(message)
  const idx = nameIndex(message, words)
  if (idx === -1) return false

  const humanIdx = humanMentionIndex(message, words)
  if (humanIdx !== -1 && humanIdx <= 1 && humanIdx < idx) return false

  return idx <= 2 || idx >= words.length - 2
}

// Check whether the bot's name appears anywhere in the message
const nameMentioned = (message: Message): boolean => nameIndex(message, messageWords(message)) !== -1

// Check whether a message is aimed at another human rather than the bot.
// Talking about someone mid-sentence ("what does @Tanox like?") doesn't count.
const addressedToSomeoneElse = async (message: Message): Promise<boolean> => {
  const botId = message.client.user?.id

  if (message.mentions.everyone) return true
  if (opensByAddressingHuman(message, messageWords(message))) return true

  if (message.reference?.messageId) {
    const referenced = await message.fetchReference().catch(() => null)
    if (referenced && referenced.author.id !== botId && referenced.author.id !== message.author.id) {
      return true
    }
  }

  return false
}

// Check whether a message directly addresses the bot
const directlyAddressed = async (message: Message): Promise<boolean> => {
  const botId = message.client.user?.id
  if (!message.guild) return true // Direct messages
  if (botId && message.mentions.users.has(botId)) return true

  if (message.reference?.messageId) {
    const referenced = await message.fetchReference().catch(() => null)
    if (referenced && referenced.author.id === botId) return true
  }

  return nameUsedAsAddress(message)
}

// Decide whether the AI should engage with a message. Returns null when it should be ignored.
const decideEngagement = async (
  message: Message,
  settings: settingsDocType,
): Promise<EngageReason | null> => {
  if (message.author.bot) return null
  if (!message.content.trim()) return null
  if (!settings.ai_bot.chat) return null

  const channelId = message.channel.id
  const userId = message.author.id

  // Direct address always engages, even alongside a human mention,
  // and so a muted user can still ask to be unmuted
  if (await directlyAddressed(message)) return "direct"

  // A message aimed at another human ends any conversation with the bot
  if (await addressedToSomeoneElse(message)) {
    endConversation(channelId, userId)
    return null
  }

  // Users who asked the bot to stop chatting only get replies when they address it directly
  const prefs = await getPreferences(userId)
  if (!prefs.chat) return null

  if (inConversation(channelId, userId)) return "conversation"

  // Outside a conversation, a message that mentions a human is between humans
  if (mentionedHumanIds(message).length) return null

  if (nameMentioned(message)) return "passing"

  return null
}

// Decide, in plain code and for free, whether the AI should engage with a non-command message.
// Returns null when the message should be ignored. Ignored messages that use the bot's name are logged for tuning.
export const gateMessage = async (
  message: Message,
  settings: settingsDocType,
): Promise<EngageReason | null> => {
  const reason = await decideEngagement(message, settings)

  if (!reason && nameMentioned(message)) {
    logger.info(`AI Bot | Ignored a message from ${message.author.username} that mentions the bot's name.`)
  }

  return reason
}
