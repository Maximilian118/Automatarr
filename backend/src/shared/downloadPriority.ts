import { Message } from "discord.js"
import moment from "moment"
import DownloadPriority, {
  DownloadPriorityType,
  PriorityContentType,
} from "../models/downloadPriority"
import Settings, { settingsDocType } from "../models/settings"
import logger from "../logger"
import { Movie } from "../types/movieTypes"
import { Series } from "../types/seriesTypes"
import { DownloadStatus } from "../types/types"
import { QueueConflict, QueueEntryDescription } from "../types/downloadPriorityTypes"
import { findMemory } from "../bots/discordBot/ai/aiMemory"
import {
  describeQueueEntries,
  entryDownloads,
  findConflicts,
  sortPriorityEntries,
  uniqueDownloadIds,
} from "./downloadPriorityUtility"
import {
  applyqBittorrentOrder,
  applySABnzbdOrder,
  getStarrQueueRecords,
  resetSABnzbdPriorities,
} from "./downloadPriorityClients"

const PASS_INTERVAL_MS = 30 * 1000 // How often the download clients are checked while requests are tracked
const GRAB_NUDGE_MS = 10 * 1000 // Delay after a Grab webhook, giving the Starr app time to refresh its queue
const WAITING_EXPIRY_MINS = 10 // Drop a request if nothing has been grabbed for it in this time
const EMPTY_TICKS_DONE = 2 // Passes with nothing left in the Starr queue before a request counts as finished
const MAX_AGE_HOURS = 48 // Stop prioritising any request after this long

let passTimer: NodeJS.Timeout | null = null
let passRunning = false

// Schedule the next priority pass, replacing any pass that's already scheduled
const schedulePass = (delayMs: number): void => {
  if (passTimer) clearTimeout(passTimer)

  passTimer = setTimeout(() => {
    passTimer = null
    void runPriorityPass()
  }, delayMs)
}

// Describe other users' downloads, respecting each user's privacy preference
const describeWithPrivacy = async (entries: DownloadPriorityType[]): Promise<string | null> => {
  const descriptions: QueueEntryDescription[] = await Promise.all(
    entries.map(async (e) => ({
      name: e.name,
      title: e.title,
      content_type: e.content_type,
      private: (await findMemory(e.discord_id))?.preferences.private ?? false,
    })),
  )

  return describeQueueEntries(descriptions)
}

// Start tracking a download a Discord user just started so it's moved to the front of the
// download queue once grabbed. Returns who the download has to wait for, or whose series it
// jumps ahead of, so the reply can say so. Returns null if anything goes wrong.
export const registerDownloadPriority = async (
  message: Message,
  content: Movie | Series,
  contentType: PriorityContentType,
): Promise<QueueConflict | null> => {
  try {
    const request = {
      content_type: contentType,
      starr_id: content.id,
      discord_id: message.author.id,
    }

    const others = await DownloadPriority.find({
      $nor: [{ content_type: contentType, starr_id: content.id }],
    }).lean()

    const { ahead, bumped } = findConflicts(request, others)

    // Keep the original requester if the same content is already being tracked
    await DownloadPriority.updateOne(
      { content_type: contentType, starr_id: content.id },
      {
        $setOnInsert: {
          title: content.title,
          discord_id: message.author.id,
          name: message.member?.displayName ?? message.author.displayName,
          requested_at: moment().format(),
          activated_at: null,
          empty_ticks: 0,
        },
      },
      { upsert: true },
    )

    if (!passRunning && !passTimer) schedulePass(PASS_INTERVAL_MS)

    return {
      ahead: await describeWithPrivacy(ahead),
      bumped: await describeWithPrivacy(bumped),
    }
  } catch (err) {
    logger.error(`Download Priority | Could not register ${content.title}: ${err}`)
    return null
  }
}

// Run a priority pass soon after a Starr app reports a grab, instead of waiting for the next pass
export const nudgeDownloadPriority = (): void => {
  if (!passRunning) schedulePass(GRAB_NUDGE_MS)
}

// Resume tracking at boot if requests were still being prioritised when Automatarr stopped
export const startDownloadPriority = async (): Promise<void> => {
  if (await DownloadPriority.exists({})) schedulePass(PASS_INTERVAL_MS)
}

// Update each entry from the Starr queues. Entries that are finished or expired are removed.
// Returns the entries that are still live and the download IDs of any expired entries.
const updateEntryStates = async (
  entries: DownloadPriorityType[],
  queueFor: (entry: DownloadPriorityType) => DownloadStatus[],
): Promise<{ live: DownloadPriorityType[]; expiredIds: string[] }> => {
  const live: DownloadPriorityType[] = []
  const expiredIds: string[] = []
  const now = moment()

  for (const entry of entries) {
    const downloads = entryDownloads(entry, queueFor(entry))
    const ageMins = now.diff(moment(entry.requested_at), "minutes")
    const update: Partial<DownloadPriorityType> = {}
    let remove = false

    if (ageMins >= MAX_AGE_HOURS * 60) {
      expiredIds.push(...uniqueDownloadIds(downloads, "usenet"))
      remove = true
    } else if (downloads.length > 0) {
      if (!entry.activated_at) {
        update.activated_at = now.format()
        logger.info(`Download Priority | ${entry.title} | Grabbed for ${entry.name}.`)
      }
      if (entry.empty_ticks > 0) update.empty_ticks = 0
    } else if (!entry.activated_at) {
      remove = ageMins >= WAITING_EXPIRY_MINS
    } else {
      update.empty_ticks = entry.empty_ticks + 1
      remove = update.empty_ticks >= EMPTY_TICKS_DONE
    }

    if (remove) {
      await DownloadPriority.deleteOne({ _id: entry._id })
      logger.info(`Download Priority | ${entry.title} | No longer prioritised.`)
      continue
    }

    if (Object.keys(update).length > 0) {
      await DownloadPriority.updateOne({ _id: entry._id }, { $set: update })
    }

    live.push({ ...entry, ...update })
  }

  return { live, expiredIds }
}

// Check the Starr queues and move every tracked download to the front of its download client
const runPriorityPass = async (): Promise<void> => {
  if (passRunning) return
  passRunning = true

  try {
    const entries = await DownloadPriority.find().lean()
    if (entries.length === 0) return

    const settings = (await Settings.findOne()) as settingsDocType
    if (!settings) return

    const hasType = (type: PriorityContentType) => entries.some((e) => e.content_type === type)
    const radarrQueue = hasType("movie") ? await getStarrQueueRecords(settings, "Radarr") : []
    const sonarrQueue = hasType("series") ? await getStarrQueueRecords(settings, "Sonarr") : []

    // Skip the pass rather than treat a failed request as an empty queue
    if (!radarrQueue || !sonarrQueue) return

    const queueFor = (entry: DownloadPriorityType) =>
      entry.content_type === "movie" ? radarrQueue : sonarrQueue

    const { live, expiredIds } = await updateEntryStates(entries, queueFor)
    await resetSABnzbdPriorities(settings, expiredIds)

    const downloads = sortPriorityEntries(live).flatMap((e) => entryDownloads(e, queueFor(e)))

    await applySABnzbdOrder(settings, uniqueDownloadIds(downloads, "usenet"))
    await applyqBittorrentOrder(settings, uniqueDownloadIds(downloads, "torrent"))
  } catch (err) {
    logger.error(`Download Priority | Pass failed: ${err}`)
  } finally {
    passRunning = false

    const remaining = await DownloadPriority.exists({}).catch(() => true)
    if (remaining) schedulePass(PASS_INTERVAL_MS)
  }
}
