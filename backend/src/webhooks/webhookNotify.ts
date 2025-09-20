import { sendDiscordNotification } from "../bots/discordBot/discordBotUtility"
import { WebHookDocType, WebHookWaitingType } from "../models/webhook"
import { saveWithRetry } from "../shared/database"
import logger from "../logger"

export const webhookNotify = async (
  waitingWebhooks: WebHookDocType, // The entire array of waitingWebhooks in the db
  webhookMatch: WebHookWaitingType, // The specific waitingWebhooks array item we've matched to the incoming webhook
): Promise<void> => {
  try {
    let shouldRemoveWebhook = true

    if (webhookMatch.bots.includes("Discord") && webhookMatch.discordData) {
      const result = await sendDiscordNotification(webhookMatch)

      if (result.success && result.messageId) {
        // Find the webhook in the waiting array and update it with the message ID
        const webhookIndex = waitingWebhooks.waiting.findIndex(
          (w) => w._id!.equals(webhookMatch._id!)
        )

        if (webhookIndex !== -1) {
          waitingWebhooks.waiting[webhookIndex].sentMessageId = result.messageId

          // Don't remove webhooks for "Grab" or "Expired" status - keep them for future "Import"/"Upgrade" edits
          // But do remove "Import" and "Upgrade" as those are final statuses
          if (webhookMatch.waitForStatus === "Grab" || webhookMatch.waitForStatus === "Expired") {
            shouldRemoveWebhook = false
          }
        }
      }
    }

    if (webhookMatch.bots.includes("Whatsapp") && webhookMatch.whatsappData) {
      // Do something here when we support whatsapp
    }

    // Remove the processed webhook from the waiting list only if it's a final status
    if (shouldRemoveWebhook) {
      waitingWebhooks.waiting = waitingWebhooks.waiting.filter(
        (w) => !w._id!.equals(webhookMatch._id!),
      )
    }

    await saveWithRetry(waitingWebhooks, "webhookNotify")
  } catch (err) {
    logger.error("Webhook | webhookNotify | Unhandled error:", err)
  }
}
