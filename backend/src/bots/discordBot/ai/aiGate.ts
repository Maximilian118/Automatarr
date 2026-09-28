import { Message } from "discord.js"
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

// Find where the bot's name appears in a message. Returns -1 if it doesn't.
const nameIndex = (message: Message, words: string[]): number => {
  const names = botNames(message)
  return words.findIndex((w) => names.includes(cleanWord(w)))
}

// Check whether the bot's name is used as a form of address,
// e.g. "Automatarr, grab me X" or "thanks automatarr", rather than talked about mid-sentence
const nameUsedAsAddress = (message: Message): boolean => {
  const words = message.content.trim().split(/\s+/)
  const idx = nameIndex(message, words)
  if (idx === -1) return false

  return idx <= 2 || idx >= words.length - 2
}

// Check whether the bot's name appears anywhere in the message
const nameMentioned = (message: Message): boolean =>
  nameIndex(message, message.content.trim().split(/\s+/)) !== -1

// The channels the AI is allowed to chat in. Empty setting = movie and series channels.
const chatChannels = (settings: settingsDocType): string[] => {
  const configured = settings.ai_bot.chat_channels.filter(Boolean)
  if (configured.length > 0) return configured

  return [settings.discord_bot.movie_channel_name, settings.discord_bot.series_channel_name].filter(Boolean)
}

// Check whether a message was sent in a channel the AI may chat in
export const isChatChannel = (message: Message, settings: settingsDocType): boolean => {
  if (!message.guild) return true // Direct messages are always allowed
  const channelName = "name" in message.channel ? message.channel.name : null
  return !!channelName && chatChannels(settings).includes(channelName)
}

// Check whether a message is aimed at another human rather than the bot
const addressedToSomeoneElse = async (message: Message): Promise<boolean> => {
  const botId = message.client.user?.id
  const mentionsBot = !!botId && message.mentions.users.has(botId)
  const mentionsHuman = message.mentions.users.some((u) => !u.bot && u.id !== message.author.id)

  if (message.mentions.everyone) return true
  if (mentionsHuman && !mentionsBot) return true

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

// Decide, in plain code and for free, whether the AI should engage with a non-command message.
// Returns null when the message should be ignored.
export const gateMessage = async (
  message: Message,
  settings: settingsDocType,
): Promise<EngageReason | null> => {
  if (message.author.bot) return null
  if (!message.content.trim()) return null
  if (!settings.ai_bot.chat) return null
  if (!isChatChannel(message, settings)) return null

  const channelId = message.channel.id
  const userId = message.author.id

  // A message aimed at another human ends any conversation with the bot
  if (await addressedToSomeoneElse(message)) {
    endConversation(channelId, userId)
    return null
  }

  // Direct address always engages, so a muted user can still ask to be unmuted
  if (await directlyAddressed(message)) return "direct"

  // Users who asked the bot to stop chatting only get replies when they address it directly
  const prefs = await getPreferences(userId)
  if (!prefs.chat) return null

  if (inConversation(channelId, userId)) return "conversation"
  if (nameMentioned(message)) return "passing"

  return null
}
