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

// Cleanup webhooks that are waiting for more than 1 day
export const webhookCleanup = async (): Promise<void> => {
  const waitingWebhooks = (await WebHook.findOne()) as WebHookDocType

  if (!waitingWebhooks) {
    logger.error("Webhook | webhookCleanup | Webhook database object not found.")
    return
  }

  const now = new Date()
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)

  // Keep only webhooks created within the last 24 hours
  waitingWebhooks.waiting = waitingWebhooks.waiting.filter((w) => {
    return w.created_at && new Date(w.created_at) > oneDayAgo
  })

  // Save to the db
  await saveWithRetry(waitingWebhooks, "WebhookCleanup")
}

export const cleanupExpiredWebhooks = async (): Promise<void> => {
  const webhookDoc = (await WebHook.findOne()) as WebHookDocType

  if (!webhookDoc) {
    logger.error("Webhook | Expiry | Webhook database object not found.")
    return
  }

  const now = new Date()
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)

  const expiredArr = webhookDoc.waiting.filter((w) => w.expiry && w.expiry <= now)

  for (const expired of expiredArr) {
    if (expired.expiry && new Date(expired.expiry) >= oneDayAgo) {
      if (expired.bots.includes("Discord") && expired.discordData) {
        sendDiscordNotification(expired, true)
      }

      if (expired.bots.includes("Whatsapp") && expired.whatsappData) {
        // Placeholder for future WhatsApp logic
      }
    }

    // Always remove expired webhook
    webhookDoc.waiting = webhookDoc.waiting.filter((w) => !w._id!.equals(expired._id!))
  }

  if (expiredArr.length > 0) {
    logger.info(
      `Webhook | Expired and Notified | [${expiredArr
        .map((w) => `${w.content.title} = ${w.waitForStatus}`)
        .join(", ")}]`,
    )
    await saveWithRetry(webhookDoc, "cleanupExpiredWebhooks")
  }
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
