import moment from "moment"
import { Message } from "discord.js"
import { BotUserType, settingsDocType } from "../../models/settings"
import { Movie } from "../../types/movieTypes"
import { Series } from "../../types/seriesTypes"
import {
  describeWatchItem,
  getCachedPlexAccounts,
  getPlexNowPlaying,
  plexAccountForUser,
  plexWatchReady,
} from "../../shared/plexRequests"
import {
  lastEpisode,
  lastWatched,
  recentShows,
  shortWatchedDate,
  viewersSince,
  watchedCountSince,
} from "../../shared/plexWatch"
import { privatePlexAccounts } from "./discordBotBrowse"
import { ensureTitleIndex, indexedById } from "./ai/aiTitleIndex"
import { findMemory, findMemoryByUsernames } from "./ai/aiMemory"
import { discordReply } from "./discordBotUtility"

// Personal Plex watch facts for the ! commands. Plex is optional and so is the AI: these work with Plex
// alone, and say nothing when Plex isn't connected, its data isn't loaded, or the person is private.

// Why someone's watch history can or can't be shown
export type PlexViewerReason = "ok" | "off" | "not_ready" | "private" | "unlinked"

// Whose Plex watch history may be shown, and under which account
export type PlexViewer = {
  accountId: number | null // Only set when show is true
  show: boolean
  reason: PlexViewerReason
}

// Decide whether watch history may be shown, once privacy is known
const viewerFrom = (
  settings: settingsDocType,
  botUser: BotUserType | undefined,
  username: string,
  isPrivate: boolean,
): PlexViewer => {
  const hidden = (reason: PlexViewerReason): PlexViewer => ({ accountId: null, show: false, reason })

  if (!settings.plex_active) return hidden("off")
  if (!plexWatchReady()) return hidden("not_ready")
  if (isPrivate) return hidden("private")

  const accountId = plexAccountForUser(settings, botUser, username)
  return accountId === null ? hidden("unlinked") : { accountId, show: true, reason: "ok" }
}

// Work out whether a person's Plex watch history may be shown in a public reply
export const plexViewer = async (
  settings: settingsDocType,
  botUser: BotUserType | undefined,
  discordId: string,
  username: string,
): Promise<PlexViewer> =>
  viewerFrom(settings, botUser, username, !!(await findMemory(discordId))?.preferences.private)

// The same check for a registered user known only by their Automatarr record, e.g. someone else's pool
export const plexViewerForUser = async (settings: settingsDocType, botUser: BotUserType): Promise<PlexViewer> =>
  viewerFrom(settings, botUser, botUser.ids[0] ?? "", !!(await findMemoryByUsernames(botUser.ids))?.preferences.private)

// A short watched mark for someone's copy of a title, e.g. "✓ watched 12 Mar" or "on S02E04". Empty if not shown.
export const watchedMark = (viewer: PlexViewer, type: "movie" | "series", item: Movie | Series): string => {
  if (!viewer.show) return ""

  if (type === "series") {
    const progress = lastEpisode(viewer.accountId, item as Series)
    return progress ? `on ${episodeCode(progress.season, progress.episode)}` : ""
  }

  const at = lastWatched(viewer.accountId, "movie", item)
  return at ? `✓ watched ${shortWatchedDate(at)}` : ""
}

// Format an episode, e.g. "S03E01"
export const episodeCode = (season: number, episode: number): string =>
  `S${String(season).padStart(2, "0")}E${String(episode).padStart(2, "0")}`

// Where someone is up to in a series, e.g. "S02E04, 3 days ago". Empty if they haven't started it.
export const seriesProgressText = (accountId: number | null, series: Series): string => {
  const progress = lastEpisode(accountId, series)
  return progress ? `${episodeCode(progress.season, progress.episode)}, ${moment(progress.at).fromNow()}` : ""
}

// A sentence about whether someone has watched a title, e.g. "You watched it on 12 Mar." or
// "You're on S02E04." Empty when their watch history can't be shown.
export const personalWatchNote = (viewer: PlexViewer, type: "movie" | "series", item: Movie | Series): string => {
  if (!viewer.show) return ""

  if (type === "series") {
    const progress = seriesProgressText(viewer.accountId, item as Series)
    return progress ? `You're on ${progress}.` : "You haven't started it on Plex yet."
  }

  const at = lastWatched(viewer.accountId, "movie", item)
  return at ? `You watched it on ${shortWatchedDate(at)}.` : "You haven't watched it on Plex yet."
}

// Most pool items suggested for removal when someone's pool is full
const MAX_REMOVAL_SUGGESTIONS = 5

// When someone's pool is full, list what in it they've already watched, numbered as in !list so
// "!remove 4" works. Empty when their watch history can't be shown or they haven't watched anything in it.
export const watchedRemovalHint = (viewer: PlexViewer, user: BotUserType, type: "movie" | "series"): string => {
  if (!viewer.show) return ""

  const pool: (Movie | Series)[] = type === "movie" ? user.pool.movies : user.pool.series

  const watched = pool
    .map((item, i) => ({ item, number: i + 1, at: lastWatched(viewer.accountId, type, item) }))
    .filter((w): w is { item: Movie | Series; number: number; at: number } => !!w.at)
    .sort((a, b) => a.at - b.at)
    .slice(0, MAX_REMOVAL_SUGGESTIONS)

  if (!watched.length) return ""

  const lines = watched.map(({ item, number, at }) => {
    const progress = type === "series" ? seriesProgressText(viewer.accountId, item as Series) : ""
    return `${number}. ${item.title} ${item.year} (${progress ? `on ${progress}` : `watched ${shortWatchedDate(at)}`})`
  })

  return `\n\nYou've watched these, so \`!remove\` one to make room:\n${lines.join("\n")}`
}

// Reply to someone whose pool is full, adding what they've already watched so they know what to remove
export const poolFullReply = async (
  message: Message,
  settings: settingsDocType,
  user: BotUserType,
  type: "movie" | "series",
  limitError: string,
): Promise<string> => {
  const viewer = await plexViewer(settings, user, message.author.id, message.author.username)
  return discordReply(`${limitError}${watchedRemovalHint(viewer, user, type)}`, "info")
}

// How far back !stats looks for recent watching
const STATS_DAYS = 30

// Most shows in progress listed by !stats
const MAX_STATS_SHOWS = 3

// Count the items in a pool someone hasn't watched yet, e.g. "3 of 10 movies"
const unwatchedCount = (accountId: number | null, items: (Movie | Series)[], type: "movie" | "series"): string =>
  `${items.filter((item) => !lastWatched(accountId, type, item)).length} of ${items.length} ${type === "movie" ? "movies" : "series"}`

// The Plex section of !stats: linked account, recent watching, what's unwatched in their pool and what's
// playing now. Says when they're private or unlinked, and is empty when Plex isn't available.
export const plexStatsSection = async (settings: settingsDocType, viewer: PlexViewer, user: BotUserType): Promise<string> => {
  if (viewer.reason === "private") return "\nPlex:\nPrivate, so watch history isn't shown.\n"
  if (viewer.reason === "unlinked") return "\nPlex:\nNot linked. An admin can link you on the Users page.\n"
  if (!viewer.show || viewer.accountId === null) return ""

  await ensureTitleIndex()
  const accountId = viewer.accountId
  const accountName = getCachedPlexAccounts().find((a) => a.id === accountId)?.name ?? "linked"

  const shows = recentShows(accountId, STATS_DAYS, MAX_STATS_SHOWS).flatMap(({ tvdbId, progress }) => {
    const show = indexedById("series", tvdbId)
    return show ? [`${show.item.title} (${episodeCode(progress.season, progress.episode)})`] : []
  })

  const playing = await getPlexNowPlaying(settings, accountId)

  return (
    `\nPlex:\n` +
    `Account: ${accountName}\n` +
    `Films watched in the last ${STATS_DAYS} days: ${watchedCountSince(accountId, "movie", STATS_DAYS)}\n` +
    `Shows in progress: ${shows.length ? shows.join(", ") : "none"}\n` +
    `Unwatched in pool: ${unwatchedCount(accountId, user.pool.movies, "movie")}, ${unwatchedCount(accountId, user.pool.series, "series")}\n` +
    (playing.length
      ? `Watching now: ${playing.map((p) => `${describeWatchItem(p)}${p.progress !== null ? `, ${p.progress}% through` : ""}`).join(", ")}\n`
      : "")
  )
}

// How far back popularity counts look
const POPULAR_DAYS = 30

// A line about who has watched a title: the requester's own watch, if shown, and how many people watched it
// this month as an anonymous count that leaves out private users. Empty without Plex.
export const searchWatchLine = async (
  settings: settingsDocType,
  requester: PlexViewer,
  type: "movie" | "series",
  item: Movie | Series,
): Promise<string> => {
  if (!settings.plex_active || !plexWatchReady()) return ""

  const viewers = viewersSince(type, item, POPULAR_DAYS, await privatePlexAccounts(settings))
  const own = watchedMark(requester, type, item)

  return [
    own ? `You: ${own}` : "",
    viewers ? `Watched by ${viewers} ${viewers === 1 ? "person" : "people"} this month` : "",
  ]
    .filter(Boolean)
    .join(" · ")
}

// The author's personal watch note for a title, e.g. "You watched it on 12 Mar." Empty when not shown.
export const authorWatchNote = async (
  message: Message,
  settings: settingsDocType,
  user: BotUserType | undefined,
  type: "movie" | "series",
  item: Movie | Series,
): Promise<string> =>
  personalWatchNote(await plexViewer(settings, user, message.author.id, message.author.username), type, item)

// A note for someone requesting something they've already watched, e.g. "(You watched this on Plex on
// 12 Mar 2025.)". Information only. Empty when they haven't watched it or their history isn't shown.
export const watchedBeforeNote = async (
  message: Message,
  settings: settingsDocType,
  user: BotUserType | undefined,
  type: "movie" | "series",
  item: Movie | Series,
): Promise<string> => {
  const viewer = await plexViewer(settings, user, message.author.id, message.author.username)
  if (!viewer.show) return ""

  if (type === "series") {
    const progress = lastEpisode(viewer.accountId, item as Series)
    return progress ? ` (You've watched up to ${episodeCode(progress.season, progress.episode)} on Plex.)` : ""
  }

  const at = lastWatched(viewer.accountId, "movie", item)
  return at ? ` (You watched this on Plex on ${moment(at).format("D MMM YYYY")}.)` : ""
}
