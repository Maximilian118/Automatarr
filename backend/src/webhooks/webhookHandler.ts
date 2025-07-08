import WebHook, { WebHookDocType } from "../models/webhook"
import { StarrWebhookType } from "../types/webhookType"
import logger from "../logger"
import { webhookNotify } from "./webhookNotify"
import { sonarrImport } from "./sonarrWebhooks/sonarrImport"

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
  const webhookMatch = waitingWebhooks.waiting.find(
    (w) => w.content.id === webhook.movie?.id && w.waitForStatus === webhook.eventType,
  )

  // Silently return as we don't want notifications for every webhook we don't care about
  if (!webhookMatch) return

  // Then decide what to do with the webhook that matches a webhookWaiting item
  const generallyNotify = ["Import", "Grab"] // Catagory of cases that we just send a general notification out for

  if (generallyNotify.includes(webhook.eventType)) {
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
  const webhookMatch = waitingWebhooks.waiting.find(
    (w) => w.content.id === webhook.series?.id && w.waitForStatus === webhook.eventType,
  )

  // Silently return as we don't want notifications for every webhook we don't care about
  if (!webhookMatch) return

  // Then decide what to do with the webhook that matches a webhookWaiting item
  const generallyNotify = ["Grab"] // Catagory of cases that we just send a general notification out for

  if (generallyNotify.includes(webhook.eventType)) {
    await webhookNotify(waitingWebhooks, webhookMatch)
    return
  }

  // When we need to handle the webhook in a specific way, we'll include a switch and handle each
  // case with its own function.
  switch (webhook.eventType) {
    case "Import":
      await sonarrImport(webhook, waitingWebhooks, webhookMatch)
      return
  }
}
