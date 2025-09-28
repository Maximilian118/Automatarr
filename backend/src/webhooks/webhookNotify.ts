import { sendDiscordNotification } from "../bots/discordBot/discordBotUtility"
import { WebHookDocType, WebHookWaitingType } from "../models/webhook"
import { saveWithRetry } from "../shared/database"
import logger from "../logger"

export const webhookNotify = async (
  waitingWebhooks: WebHookDocType, // The entire array of waitingWebhooks in the db
  webhookMatch: WebHookWaitingType, // The specific waitingWebhooks array item we've matched to the incoming webhook
): Promise<void> => {
  try {
    if (webhookMatch.bots.includes("Discord") && webhookMatch.discordData) {
      await sendDiscordNotification(webhookMatch)
    }

    if (webhookMatch.bots.includes("Whatsapp") && webhookMatch.whatsappData) {
      // Do something here when we support whatsapp
    }

    // Always remove the processed webhook from the waiting list
    waitingWebhooks.waiting = waitingWebhooks.waiting.filter(
      (w) => !w._id!.equals(webhookMatch._id!),
    )

    await saveWithRetry(waitingWebhooks, "webhookNotify")
  } catch (err) {
    logger.error("Webhook | webhookNotify | Unhandled error:", err)
  }
}
