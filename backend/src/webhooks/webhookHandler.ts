import WebHook, { WebHookDocType } from "../models/webhook"
import { StarrWebhookType } from "../types/webhookType"
import logger from "../logger"
import { webhookNotify } from "./webhookNotify"
import { sonarrImport } from "./sonarrWebhooks/sonarrImport"
import { isMovie, isSeries } from "../types/typeGuards"
import {
  randomMovieReadyMessage,
  randomSeriesReadyMessage,
} from "../bots/discordBot/discordBotRandomReply"
import { sendDiscordNotification } from "../bots/discordBot/discordBotUtility"
import { saveWithRetry } from "../shared/database"

// Helper funtion that translates webhook.eventType into something more specific
export const starrWebhookEventType = (webhook: StarrWebhookType): StarrWebhookType => {
  if (webhook.eventType === "Download") {
    if (webhook.isUpgrade) {
      return {
        ...webhook,
        eventType: "Upgrade",
      }
    } else {
      return {
        ...webhook,
        eventType: "Import",
      }
    }
  }

  return webhook
}

// Handle any webhooks sent by Radarr
export const handleRadarrWebhook = async (webhook: StarrWebhookType): Promise<void> => {
  const waitingWebhooks = (await WebHook.findOne()) as WebHookDocType
  let title = ""

  switch (true) {
    case !!webhook.movie:
      title = webhook.movie.title
      break
    case !!webhook.release:
      title = webhook.release.releaseTitle
      break
    default:
      title = "Unknown Title."
      break
  }

  if (!waitingWebhooks) {
    logger.error(
      `Webhook | handleRadarrWebhook | ${webhook.eventType} | ${title} | Webhook databse object not found.`,
    )

    return
  }

  if (!webhook.movie) {
    logger.error(
      `Webhook | handleRadarrWebhook | ${webhook.eventType} | ${title} | No movie found in the webhook.`,
    )

    return
  }

  // Find the webhookWaiting that matches the webhook content and the eventType for that content
  let webhookMatch = waitingWebhooks.waiting.find(
    (w) =>
      (w.content.id === webhook.movie?.id ||
        (isMovie(w.content) && webhook.movie && w.content.tmdbId === webhook.movie.tmdbId)) &&
      w.waitForStatus === webhook.eventType,
  )

  // Silently return as we don't want notifications for every webhook we don't care about
  if (!webhookMatch) return

  // Generate appropriate message for the event
  if (webhook.eventType === "Import" || webhook.eventType === "Upgrade") {
    if (webhookMatch.discordData) {
      const userMention = webhookMatch.discordData.authorMention
      webhookMatch.message = randomMovieReadyMessage(userMention, webhookMatch.content.title)
    }
  }

  logger.info(`Webhook | Radarr | ${title} | ${webhook.eventType} event processed`)

  // Handle different event types
  if (webhook.eventType === "Grab") {
    // For Grab events, send notification but keep webhook in waiting list for potential Import edits
    if (webhookMatch.bots.includes("Discord") && webhookMatch.discordData) {
      const result = await sendDiscordNotification(webhookMatch)

      // Store the message ID for future edits
      if (result.success && result.messageId) {
        webhookMatch.sentMessageId = result.messageId

        // Find corresponding Import webhook for the same movie and share the message ID
        const importWebhook = waitingWebhooks.waiting.find(
          (w) =>
            (w.content.id === webhook.movie?.id ||
              (isMovie(w.content) && webhook.movie && w.content.tmdbId === webhook.movie.tmdbId)) &&
            w.waitForStatus === "Import",
        )

        // Remove the Grab webhook (it's done its job) and update Import webhook with message ID
        waitingWebhooks.waiting = waitingWebhooks.waiting
          .filter((w) => {
            if (w._id!.equals(webhookMatch._id)) {
              return false // Remove Grab webhook
            }
            return true
          })
          .map((w) => {
            if (importWebhook && w._id!.equals(importWebhook._id)) {
              return { ...w, sentMessageId: result.messageId } // Share message ID with Import webhook
            }
            return w
          })

        await saveWithRetry(waitingWebhooks, "handleRadarrWebhook")
      }
    }
    return
  }

  // For Import/Upgrade events, send notification and remove from waiting list (final status)
  if (webhook.eventType === "Import" || webhook.eventType === "Upgrade") {
    await webhookNotify(waitingWebhooks, webhookMatch)
    return
  }
}

// Handler any webhooks sent by Sonarr
export const handleSonarrWebhook = async (webhook: StarrWebhookType): Promise<void> => {
  const waitingWebhooks = (await WebHook.findOne()) as WebHookDocType
  let title = ""

  switch (true) {
    case !!webhook.series:
      title = webhook.series.title
      break
    case !!webhook.release:
      title = webhook.release.releaseTitle
      break
    default:
      title = "Unknown Title."
      break
  }

  if (!waitingWebhooks) {
    logger.error(
      `Webhook | handleSonarrWebhook | ${webhook.eventType} | ${title} | Webhook databse object not found.`,
    )

    return
  }

  if (!webhook.series) {
    logger.error(
      `Webhook | handleSonarrWebhook | ${webhook.eventType} | ${title} | No series found in the webhook.`,
    )

    return
  }

  // Find the webhookWaiting that matches the webhook content and the eventType for that content
  let webhookMatch = waitingWebhooks.waiting.find(
    (w) =>
      (w.content.id === webhook.series?.id ||
        (isSeries(w.content) && webhook.series && w.content.tvdbId === webhook.series.tvdbId)) &&
      w.waitForStatus === webhook.eventType,
  )

  // Silently return as we don't want notifications for every webhook we don't care about
  if (!webhookMatch) return

  // Generate appropriate message for Upgrade events only (Import messages handled in sonarrImport)
  if (webhook.eventType === "Upgrade") {
    if (webhookMatch.discordData) {
      const userMention = webhookMatch.discordData.authorMention
      webhookMatch.message = randomSeriesReadyMessage(userMention, webhookMatch.content.title)
    }
  }

  // Only log non-Import events (Import events are noisy and logged in sonarrImport when complete)
  if (webhook.eventType !== "Import") {
    logger.info(`Webhook | Sonarr | ${title} | ${webhook.eventType} event processed`)
  }

  // Handle different event types
  if (webhook.eventType === "Grab") {
    // For Grab events, send notification but keep webhook in waiting list for potential Import edits
    if (webhookMatch.bots.includes("Discord") && webhookMatch.discordData) {
      const result = await sendDiscordNotification(webhookMatch)

      // Store the message ID for future edits
      if (result.success && result.messageId) {
        webhookMatch.sentMessageId = result.messageId

        // Find corresponding Import webhook for the same series and share the message ID
        const importWebhook = waitingWebhooks.waiting.find(
          (w) =>
            (w.content.id === webhook.series?.id ||
              (isSeries(w.content) && webhook.series && w.content.tvdbId === webhook.series.tvdbId)) &&
            w.waitForStatus === "Import",
        )

        // Remove the Grab webhook (it's done its job) and update Import webhook with message ID
        waitingWebhooks.waiting = waitingWebhooks.waiting
          .filter((w) => {
            if (w._id!.equals(webhookMatch._id)) {
              return false // Remove Grab webhook
            }
            return true
          })
          .map((w) => {
            if (importWebhook && w._id!.equals(importWebhook._id)) {
              return { ...w, sentMessageId: result.messageId } // Share message ID with Import webhook
            }
            return w
          })

        await saveWithRetry(waitingWebhooks, "handleSonarrWebhook")
      }
    }
    return
  }

  // Handle Upgrade events
  if (webhook.eventType === "Upgrade") {
    await webhookNotify(waitingWebhooks, webhookMatch)
    return
  }

  // Import events for series need special handling for episode tracking
  if (webhook.eventType === "Import") {
    await sonarrImport(webhook, waitingWebhooks, webhookMatch)
    return
  }
}
