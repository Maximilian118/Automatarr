import { GuildTextBasedChannel, Message } from "discord.js"

// Marks messages that were built by the AI so a failed command can't bounce back to the AI
const AI_COMMAND_FLAG = Symbol("automatarrAICommand")

// Build a copy of a real message with different content, e.g. "!download Toy Story 2 1999".
// The copy inherits the author from the real message, so existing command handlers,
// permission checks and webhook notifications behave exactly as if the user typed it.
// When a target channel is given, the copy appears to have been sent there instead. discord.js
// resolves channel, guild and member from these IDs, so all command output lands in that channel.
export const buildCommandMessage = (
  message: Message,
  content: string,
  targetChannel?: GuildTextBasedChannel,
): Message => {
  const synthetic = Object.create(message) as Message

  Object.defineProperty(synthetic, "content", { value: content, enumerable: true })
  Object.defineProperty(synthetic, AI_COMMAND_FLAG, { value: true })

  if (targetChannel) {
    Object.defineProperty(synthetic, "channelId", { value: targetChannel.id, enumerable: true })
    Object.defineProperty(synthetic, "guildId", { value: targetChannel.guildId, enumerable: true })
  }

  return synthetic
}

// Check whether a message was built by the AI rather than typed by a user
export const isAICommandMessage = (message: Message): boolean =>
  Reflect.get(message, AI_COMMAND_FLAG) === true
