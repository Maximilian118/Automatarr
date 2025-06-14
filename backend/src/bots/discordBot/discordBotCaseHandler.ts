import { Message } from "discord.js"
import { sendDiscordMessage } from "./discordBotUtility"
import { adminCheck } from "./discordBotUtility"
import logger from "../../logger"
import { randomCrashedMessage } from "./discordBotRandomReply"

type CaseFunction = (message: Message) => Promise<string>

export const handleDiscordCase = async (
  message: Message,
  caseFn: CaseFunction,
  adminRequired: boolean = false,
): Promise<void> => {
  try {
    if (adminRequired) {
      const adminError = await adminCheck(message)
      if (adminError) {
        await sendDiscordMessage(message, adminError)
        return
      }
    }

    const reply = await caseFn(message)
    await sendDiscordMessage(message, reply)
  } catch (err) {
    logger.error(`Command failed: ${message.content}`, err)
    await sendDiscordMessage(message, randomCrashedMessage(err))
  }
}
