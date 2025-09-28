import WebHook, {
  DiscordDataType,
  EventType,
  WebHookDocType,
  WebHookWaitingType,
} from "../models/webhook"
import logger from "../logger"
import { saveWithRetry } from "../shared/database"
import { Movie } from "../types/movieTypes"
import { Series } from "../types/seriesTypes"
import { Episode } from "../types/episodeTypes"
import { Message } from "discord.js"
import { isMovie, isSeries } from "../types/typeGuards"
import { sendDiscordNotification } from "../bots/discordBot/discordBotUtility"

// Ensure the webHook dataset has been created
export const newWebhook = async (): Promise<WebHookDocType> => {
  const webhook = (await WebHook.findOne()) as WebHookDocType

  // Return webhook object if it already exists
  if (webhook) {
    logger.success("Webhook | Found existing webhook object in database.")
    return webhook
  }

  // Create new Webhook object
  const newWebhook = new WebHook({}, (err: string) => {
    if (err) {
      logger.error("Webhook | Could not create new webhook object.")
      throw new Error(err)
    }
  }) as WebHookDocType

  // Save the new webhook object to the database
  await saveWithRetry(newWebhook, "newWebhook")
  logger.success("Webhook | New webhook object created.")

  return newWebhook
}

export type QueueNotificationType = {
  waitForStatus: EventType
  message: string
  expiry?: Date
  expired_message?: string
}

export const waitForWebhooks = async (
  queueNotifications: QueueNotificationType[],
  APIName: "Radarr" | "Sonarr" | "Lidarr", // API sending the webhook
  bots: ("Discord" | "Whatsapp")[], // Which bots is this intended for?
  discordMessage: Message | null, // All the data discord needs to send a message
  whatsapp: null, // All the data whatsapp needs to send a message
  content: Movie | Series | Episode, // What is the topic
) => {
  if (!queueNotifications.length) {
    logger.error(`Webhook | waitForWebhooks called but nothing in queueNotifications.`)
    return
  }

  try {
    const waitingWebhooks = (await WebHook.findOne()) as WebHookDocType

    // Return webhook object if it already exists
    if (!waitingWebhooks) {
      logger.success("Webhook | Couldn't find waitingWebhooks object in the database.")
      return
    }

    // Loop through all of the status's and create waiting objects for each status with the same content
    for (const w of queueNotifications) {
      await waitForWebhook(
        waitingWebhooks,
        APIName,
        bots,
        discordMessage,
        whatsapp,
        content,
        w.waitForStatus,
        w.message,
        w.expiry,
        w.expired_message,
      )
    }

    // Save the new webhook object to the database
    const saveSuccess = await saveWithRetry(waitingWebhooks, "waitForWebhooks")

    if (saveSuccess) {
      logger.success(
        `Webhook | Queued notifications | [${queueNotifications
          .map((q) => q.waitForStatus)
          .join(", ")}] | ${content.title}`,
      )
    }
  } catch (err) {
    logger.error(`Webhook | Failed to queue webhooks: ${err instanceof Error ? err.message : err}`)
  }
}

// Add a notification to the queue.
// When the webhook that matches comes through, send the pre-defined notification.
const waitForWebhook = async (
  waitingWebhooks: WebHookDocType,
  APIName: "Radarr" | "Sonarr" | "Lidarr", // API sending the webhook
  bots: ("Discord" | "Whatsapp")[], // Which bots is this intended for?
  discordMessage: Message | null, // All the data discord needs to send a message
  whatsapp: null, // All the data whatsapp needs to send a message
  content: Movie | Series | Episode, // What is the topic
  waitForStatus: EventType, // Status are we waiting for
  message: string, // Message for the user
  expiry?: Date,
  expired_message?: string,
): Promise<void> => {
  const discordData: DiscordDataType = {
    guildId: discordMessage?.guild?.id ?? "",
    channelId: discordMessage?.channel?.id ?? "",
    authorId: discordMessage?.author?.id ?? "",
    authorUsername: discordMessage?.author?.username ?? "",
    authorMention: discordMessage?.author?.toString() ?? "",
    messageId: discordMessage?.id ?? "",
  }

  const waiting: WebHookWaitingType = {
    APIName,
    bots,
    discordData,
    whatsappData: whatsapp,
    content,
    seasons: [],
    episodes: [],
    waitForStatus,
    status: "waiting",
    message,
    expiry,
    expired_message,
    created_at: new Date(),
  }

  // Remove any existing waiting entries for this content and waitForStatus combo
  const originalLength = waitingWebhooks.waiting.length

  waitingWebhooks.waiting = waitingWebhooks.waiting.filter((w) => {
    const isSameMovie =
      isMovie(w.content) &&
      isMovie(content) &&
      w.content.tmdbId === content.tmdbId &&
      w.waitForStatus === waitForStatus
    const isSameSeries =
      isSeries(w.content) &&
      isSeries(content) &&
      w.content.tvdbId === content.tvdbId &&
      w.waitForStatus === waitForStatus
    return !(isSameMovie || isSameSeries)
  })

  if (waitingWebhooks.waiting.length < originalLength) {
    logger.warn(`Webhook | Removed existing waiting entry for ${waitForStatus} | ${content.title}`)
  }

  waitingWebhooks.waiting.push(waiting)
}

// Cleanup webhooks with multi-layered safeguards:
// 1. ABSOLUTE SAFEGUARD: Remove ANY webhook older than 48 hours (prevents indefinite accumulation)
// 2. Remove webhooks older than 24 hours (normal cleanup)
// 3. Keep "Expired" webhooks for 24h grace period for potential Import/Upgrade edits
export const webhookCleanup = async (): Promise<void> => {
  const waitingWebhooks = (await WebHook.findOne()) as WebHookDocType

  if (!waitingWebhooks) {
    logger.error("Webhook | webhookCleanup | Webhook database object not found.")
    return
  }

  const now = new Date()
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)

  const originalLength = waitingWebhooks.waiting.length

  // Filter webhooks with absolute maximum age safeguard
  const twoDaysAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000) // 48 hours ago
  let removedForAge = 0

  waitingWebhooks.waiting = waitingWebhooks.waiting.filter((w) => {
    // ABSOLUTE SAFEGUARD: Remove ANY webhook older than 48 hours regardless of status
    if (w.created_at && new Date(w.created_at) <= twoDaysAgo) {
      removedForAge++
      logger.warn(
        `Webhook | Removing webhook older than 48h | ${w.content.title} = ${w.waitForStatus} | Created: ${w.created_at}`,
      )
      return false
    }

    // Keep recent webhooks (created within 24 hours)
    if (w.created_at && new Date(w.created_at) > oneDayAgo) {
      return true
    }

    // Keep expired webhooks that are still within 24 hours of their expiry date
    if (w.waitForStatus === "Expired" && w.expiry && new Date(w.expiry) > now) {
      return true
    }

    // Remove everything else (old webhooks and old expired webhooks)
    return false
  })

  if (removedForAge > 0) {
    logger.info(`Webhook | Cleanup | Removed ${removedForAge} webhook(s) for exceeding 48h maximum age`)
  }

  if (waitingWebhooks.waiting.length < originalLength) {
    await saveWithRetry(waitingWebhooks, "WebhookCleanup")
    logger.info(
      `Webhook | Cleanup | Removed ${
        originalLength - waitingWebhooks.waiting.length
      } expired webhook(s).`,
    )
  }
}

// Simplified expiry logic - send "Not Found" message and remove expired webhooks
export const cleanupExpiredWebhooks = async (): Promise<void> => {
  const webhookDoc = (await WebHook.findOne()) as WebHookDocType

  if (!webhookDoc) {
    logger.error("Webhook | Expiry | Webhook database object not found.")
    return
  }

  const now = new Date()
  const expiredWebhooks = webhookDoc.waiting.filter((w) => w.expiry && w.expiry <= now)

  if (expiredWebhooks.length === 0) return

  const removedWebhooks: string[] = []

  for (const webhook of expiredWebhooks) {
    // Send "Not Found" message for Grab webhooks that have expired_message
    if (webhook.waitForStatus === "Grab" && webhook.expired_message) {
      if (webhook.bots.includes("Discord") && webhook.discordData) {
        // Create a temporary webhook object for sending the notification
        const notificationWebhook: WebHookWaitingType = {
          ...webhook,
          message: webhook.expired_message,
          expired_message: webhook.expired_message, // Ensure expired_message is properly set
          discordData: webhook.discordData, // Explicitly ensure discordData is included
          content: webhook.content // Explicitly ensure content is included
        }

        // If we previously sent a "Downloading" message, edit it to "Not Found"
        // If we never got a Grab webhook, send a new "Not Found" message
        if (webhook.sentMessageId) {
          notificationWebhook.sentMessageId = webhook.sentMessageId
        }

        await sendDiscordNotification(notificationWebhook, true)
      } else {
        logger.warn(`Webhook | Expiry | Skipping Discord notification for ${webhook.content.title} - discordData missing: ${!webhook.discordData}`)
      }

      // Find and remove corresponding Import webhook since the download failed
      const importWebhook = webhookDoc.waiting.find(
        (w) => {
          const isSameMovie = isMovie(w.content) && isMovie(webhook.content) &&
                              w.content.tmdbId === webhook.content.tmdbId &&
                              w.waitForStatus === "Import"
          const isSameSeries = isSeries(w.content) && isSeries(webhook.content) &&
                               w.content.tvdbId === webhook.content.tvdbId &&
                               w.waitForStatus === "Import"
          return isSameMovie || isSameSeries
        }
      )

      if (importWebhook) {
        // Remove the orphaned Import webhook since the download failed
        webhookDoc.waiting = webhookDoc.waiting.filter((w) => !w._id!.equals(importWebhook._id))
        removedWebhooks.push(`${webhook.content.title} = Import (orphaned)`)
      }
    }

    removedWebhooks.push(`${webhook.content.title} = ${webhook.waitForStatus}`)
  }

  // Remove all expired webhooks
  webhookDoc.waiting = webhookDoc.waiting.filter((w) =>
    !expiredWebhooks.some(expired => w._id!.equals(expired._id!))
  )

  await saveWithRetry(webhookDoc, "cleanupExpiredWebhooks")

}

let expiryWatcherStarted = false

export const startWebhookExpiryWatcher = () => {
  if (expiryWatcherStarted) return
  expiryWatcherStarted = true

  setInterval(async () => {
    try {
      await cleanupExpiredWebhooks()
    } catch (err) {
      logger.error("Webhook | Expiry | Error checking for expired webhooks:", err)
    }
  }, 60 * 1000)

  logger.info("Webhook | Expiry | Started expiry watcher.")
}

// Cancel pending webhooks for specific content when removed from user pools
export const cancelWebhooksForContent = async (content: Movie | Series): Promise<void> => {
  try {
    const webhookDoc = (await WebHook.findOne()) as WebHookDocType

    if (!webhookDoc) {
      logger.warn("Webhook | Cancel | No webhook document found in database")
      return
    }

    const originalLength = webhookDoc.waiting.length

    // Remove webhooks matching the content
    webhookDoc.waiting = webhookDoc.waiting.filter((w) => {
      const isSameMovie =
        isMovie(w.content) &&
        isMovie(content) &&
        w.content.tmdbId === content.tmdbId
      const isSameSeries =
        isSeries(w.content) &&
        isSeries(content) &&
        w.content.tvdbId === content.tvdbId

      // Keep webhooks that don't match this content
      return !(isSameMovie || isSameSeries)
    })

    const removedCount = originalLength - webhookDoc.waiting.length

    if (removedCount > 0) {
      await saveWithRetry(webhookDoc, "cancelWebhooksForContent")
      logger.info(
        `Webhook | Cancel | Removed ${removedCount} pending webhook(s) for content: ${content.title}`
      )
    }
  } catch (err) {
    logger.error(`Webhook | Cancel | Failed to cancel webhooks for content: ${err instanceof Error ? err.message : err}`)
  }
}
