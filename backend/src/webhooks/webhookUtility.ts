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

// Add a notification to the queue.
// When the webhook that matches comes through, send the pre-defined notification.
export const waitForWebhook = async (
  APIName: "Radarr" | "Sonarr" | "Lidarr", // API sending the webhook
  bots: ("Discord" | "Whatsapp")[], // Which bots is this intended for?
  discordMessage: Message | null, // All the data discord needs to send a message
  whatsapp: null, // All the data whatsapp needs to send a message
  content: Movie | Series | Episode, // What is the topic
  waitForStatus: EventType, // Status are we waiting for
  message: string, // Message for the user
): Promise<void> => {
  try {
    const waitingWebhooks = (await WebHook.findOne()) as WebHookDocType

    // Return webhook object if it already exists
    if (!waitingWebhooks) {
      logger.success("Webhook | Couldn't find waitingWebhooks object in the database.")
      return
    }

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
      created_at: new Date(),
    }

    // Remove any existing waiting entries for this content
    waitingWebhooks.waiting = waitingWebhooks.waiting.filter((w) => {
      const isSameMovie =
        isMovie(w.content) && isMovie(content) && w.content.tmdbId === content.tmdbId
      const isSameSeries =
        isSeries(w.content) && isSeries(content) && w.content.tvdbId === content.tvdbId
      return !(isSameMovie || isSameSeries)
    })

    waitingWebhooks.waiting.push(waiting)

    // Save the new webhook object to the database
    await saveWithRetry(waitingWebhooks, "waitForWebhook")

    logger.success(
      `Webhook | Queued notification | Waiting for ${waitForStatus} | ${content.title}`,
    )
  } catch (err) {
    logger.error(`Webhook | Failed to queue webhook: ${err instanceof Error ? err.message : err}`)
  }
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
