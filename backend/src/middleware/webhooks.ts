import { Router, Request, Response } from "express"
import logger from "../logger"
import { settingsDocType } from "../models/settings"
import { StarrWebhookType } from "../types/webhookType"
import {
  handleRadarrWebhook,
  handleSonarrWebhook,
  starrWebhookEventType,
} from "../webhooks/webhookHandler"
import {
  cleanupExpiredWebhooks,
  startWebhookExpiryWatcher,
  webhookCleanup,
} from "../webhooks/webhookUtility"

const createWebhookRouter = (settings: settingsDocType) => {
  const router = Router()

  router.all("/", async (req: Request, res: Response): Promise<void> => {
    const { token } = req.query
    const webhook = req.body as StarrWebhookType

    if (!settings.webhooks_enabled) {
      logger.warn(`Webhook | API: ${webhook.instanceName} | Webhooks disabled!`)
      res.status(403).send("Webhooks disabled")
      return
    }

    if (token !== settings.webhooks_token) {
      logger.warn(`Webhook | Invalid token: ${token}`)
      res.status(401).send("Unauthorized")
      return
    }

    // 1. Remove stale webhooks (older than 1 day)
    await webhookCleanup()

    // 2. Immediately remove expired webhooks (expiry timestamp passed)
    await cleanupExpiredWebhooks()

    // 3. Start expiry watcher if not already started
    startWebhookExpiryWatcher()

    // 4. Process webhook
    switch (webhook.instanceName) {
      case "Radarr":
        await handleRadarrWebhook(starrWebhookEventType(webhook))
        break
      case "Sonarr":
        await handleSonarrWebhook(starrWebhookEventType(webhook))
        break
      default:
        logger.warn(
          `Webhook | Unknown API: ${webhook.instanceName ? webhook.instanceName : "Unknown"}`,
        )
        break
    }

    res.status(200).send("Webhook received")
  })

  return router
}

export default createWebhookRouter
