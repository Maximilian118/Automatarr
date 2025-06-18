import { sendDiscordNotification } from "../../bots/discordBot/discordBotUtility"
import { WebHookDocType, WebHookWaitingType } from "../../models/webhook"
import { saveWithRetry } from "../../shared/database"
import logger from "../../logger"

export const radarrImport = async (
  waitingWebhooks: WebHookDocType,
  webhookMatch: WebHookWaitingType,
): Promise<void> => {
  try {
    if (webhookMatch.bots.includes("Discord") && webhookMatch.discordData) {
      sendDiscordNotification(webhookMatch)
    }

    if (webhookMatch.bots.includes("Whatsapp") && webhookMatch.whatsappData) {
      // Do something here when we support whatsapp
    }

    // Remove the processed webhook from the waiting list
    waitingWebhooks.waiting = waitingWebhooks.waiting.filter(
      (w) => !w._id!.equals(webhookMatch._id!),
    )

    await saveWithRetry(waitingWebhooks, "handleRadarrWebhook")
  } catch (err) {
    logger.error("Webhook | radarrImport | Unhandled error:", err)
  }
}
