import WebHook, { WebHookDocType } from "../models/webhook"
import { StarrWebhookType } from "../types/webhookType"
import logger from "../logger"
import { radarrImport } from "./radarrWebhooks/radarrImport"
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

  if (!waitingWebhooks) {
    logger.error("Webhook | handleRadarrWebhook | Webhook databse object not found.")
    return
  }

  if (!webhook.movie) {
    logger.error("Webhook | handleRadarrWebhook | No movie found in the webhook.")
    return
  }

  const webhookMatch = waitingWebhooks.waiting.find(
    (w) => w.content.id === webhook.movie?.id && w.waitForStatus === webhook.eventType,
  )

  // Silently return as we don't want notifications for every webhook we don't care about
  if (!webhookMatch) return

  switch (webhook.eventType) {
    case "Import":
      await radarrImport(waitingWebhooks, webhookMatch)
      return
  }
}

// Handler any webhooks sent by Sonarr
export const handleSonarrWebhook = async (webhook: StarrWebhookType): Promise<void> => {
  const waitingWebhooks = (await WebHook.findOne()) as WebHookDocType

  if (!waitingWebhooks) {
    logger.error("Webhook | handleSonarrWebhook | Webhook databse object not found.")
    return
  }

  if (!webhook.series) {
    logger.error("Webhook | handleSonarrWebhook | No series found in the webhook.")
    return
  }

  // Find the webhookWaiting for this series
  let webhookMatch = waitingWebhooks.waiting.find((w) => w.content.id === webhook.series?.id)

  if (!webhookMatch) return

  switch (webhook.eventType) {
    case "Import":
      await sonarrImport(webhook, waitingWebhooks, webhookMatch)
      return
  }
}
