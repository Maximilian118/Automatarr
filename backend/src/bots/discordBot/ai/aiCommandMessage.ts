import { Message } from "discord.js"

// Marks messages that were built by the AI so a failed command can't bounce back to the AI
const AI_COMMAND_FLAG = Symbol("automatarrAICommand")

// Build a copy of a real message with different content, e.g. "!download Toy Story 2 1999".
// The copy inherits the author, channel and guild from the real message, so existing command
// handlers, permission checks and webhook notifications all behave exactly as if the user typed it.
export const buildCommandMessage = (message: Message, content: string): Message => {
  const synthetic = Object.create(message) as Message

  Object.defineProperty(synthetic, "content", { value: content, enumerable: true })
  Object.defineProperty(synthetic, AI_COMMAND_FLAG, { value: true })

  return synthetic
}

// Check whether a message was built by the AI rather than typed by a user
export const isAICommandMessage = (message: Message): boolean =>
  Reflect.get(message, AI_COMMAND_FLAG) === true
