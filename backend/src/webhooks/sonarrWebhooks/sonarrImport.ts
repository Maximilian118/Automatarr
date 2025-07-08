import Settings, { settingsDocType } from "../../models/settings"
import { BasicEpisodeDataType, WebHookDocType, WebHookWaitingType } from "../../models/webhook"
import logger from "../../logger"
import { getSonarrSeries } from "../../shared/SonarrStarrRequests"
import { saveWithRetry } from "../../shared/database"
import { StarrWebhookType } from "../../types/webhookType"
import { sendDiscordNotification } from "../../bots/discordBot/discordBotUtility"

const saveWebhookMatch = async (
  waitingWebhooks: WebHookDocType,
  webhookMatch: WebHookWaitingType,
): Promise<void> => {
  waitingWebhooks.waiting = waitingWebhooks.waiting.map((ww) =>
    ww._id!.equals(webhookMatch._id) ? { ...webhookMatch } : ww,
  )

  await saveWithRetry(waitingWebhooks, "sonarrImport")
}

export const sonarrImport = async (
  webhook: StarrWebhookType,
  waitingWebhooks: WebHookDocType,
  webhookMatch: WebHookWaitingType,
): Promise<void> => {
  try {
    if (!webhook.series) {
      logger.error("Webhook | sonarrImport | No series found in the webhook.")
      return
    }

    let shouldSave = false

    const settings = (await Settings.findOne()) as settingsDocType

    if (!settings) {
      logger.error("Webhook | sonarrImport | No settings were found.")
      return
    }

    const series = await getSonarrSeries(settings, webhook.series.id)

    if (!series) {
      logger.error("Webhook | sonarrImport | No series by that ID.")
      return
    }

    // If this is the first time we're seeing a notification about this series, request series for populated seasons data
    if (webhookMatch.seasons.length === 0) {
      webhookMatch.seasons = series.seasons

      waitingWebhooks.waiting = waitingWebhooks.waiting.map((ww) => {
        if (ww._id!.equals(webhookMatch!._id)) {
          return {
            ...ww,
            seasons: series.seasons,
          }
        } else {
          return ww
        }
      })

      shouldSave = true
    }

    // Now that we've ensured webhookMatch has populated season data we can use that data
    // to know how many episodes need to be imported before we consider the enire series
    // to be imported and therefore send the notification.

    // If this is the first notification for this series then we won't have initialised episodes
    if (webhookMatch.episodes.length === 0) {
      const episodes: BasicEpisodeDataType[] = []

      for (const season of webhookMatch.seasons) {
        if (!season.statistics || season.seasonNumber === 0 || !season.monitored) continue // Skip specials or invalid seasons

        for (let i = 1; i <= season.statistics.episodeCount; i++) {
          episodes.push({
            seasonNumber: season.seasonNumber,
            episodeNumber: i,
            imported: false,
          })
        }
      }

      webhookMatch.episodes = episodes

      waitingWebhooks.waiting = waitingWebhooks.waiting.map((ww) =>
        ww._id!.equals(webhookMatch._id) ? { ...webhookMatch } : ww,
      )

      shouldSave = true
    }

    if (!webhook.episodes?.length) {
      logger.error("Webhook | sonarrImport | No episodes array found.")
      if (shouldSave) await saveWebhookMatch(waitingWebhooks, webhookMatch)
      return
    }

    // Find and mark as imported
    for (const importedEpisode of webhook.episodes) {
      let episodeUpdated = false

      webhookMatch.episodes = webhookMatch.episodes.map((ep) => {
        if (
          ep.seasonNumber === importedEpisode.seasonNumber &&
          ep.episodeNumber === importedEpisode.episodeNumber &&
          !ep.imported // only update if not already true
        ) {
          episodeUpdated = true
          return { ...ep, imported: true }
        }
        return ep
      })

      if (episodeUpdated) {
        shouldSave = true
      }
    }

    const allImported =
      webhookMatch.episodes.every((ep) => ep.imported) ||
      series.statistics.percentOfEpisodes === 100

    if (allImported) {
      // All the episodes are imported. Hazah! Send notifications about it.
      if (webhookMatch.bots.includes("Discord") && webhookMatch.discordData) {
        await sendDiscordNotification(webhookMatch)
      }

      if (webhookMatch.bots.includes("Whatsapp") && webhookMatch.whatsappData) {
        // Do something here when we support whatsapp
      }

      // Remove from waiting list
      waitingWebhooks.waiting = waitingWebhooks.waiting.filter(
        (w) => !w._id!.equals(webhookMatch._id),
      )

      shouldSave = true
    }

    // Commit all updates if needed
    if (shouldSave) await saveWebhookMatch(waitingWebhooks, webhookMatch)
  } catch (err) {
    logger.error("Webhook | sonarrImport | Unhandled error:", err)
    console.log(err)
  }
}
