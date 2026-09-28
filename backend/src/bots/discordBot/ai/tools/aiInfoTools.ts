import Data, { dataDocType } from "../../../../models/data"
import { BotUserType } from "../../../../models/settings"
import { searchRadarr } from "../../../../shared/RadarrStarrRequests"
import { searchSonarr } from "../../../../shared/SonarrStarrRequests"
import {
  describeWatchItem,
  findPlexAccountId,
  getCachedPlexHistory,
  getPlexNowPlaying,
} from "../../../../shared/plexRequests"
import { matchedDiscordUser, matchedUser } from "../../discordBotUtility"
import { describeMovie, describeSeries, searchLibraries } from "../aiMediaFormat"
import { describePreferences, findMemory } from "../aiMemory"
import { getRequestHistory, topGenres } from "../aiRequestLog"
import { ToolContext, ToolHandler, inputString, inputYear } from "./aiToolTypes"

// Whether personal info about the speaker may be mentioned in this conversation
export const personalInfoAllowed = (ctx: ToolContext): boolean =>
  ctx.isDirectMessage || !ctx.preferences.private

// Summarise a bot user's pool as short title lists. Pools are public via !list.
const describePool = (user: BotUserType): string => {
  const movies = user.pool.movies.map((m) => `${m.title} (${m.year})`)
  const series = user.pool.series.map((s) => `${s.title} (${s.year})`)

  return [
    `Movies in pool: ${movies.length ? movies.join(", ") : "none"}`,
    `Series in pool: ${series.length ? series.join(", ") : "none"}`,
  ].join("\n")
}

// Build the speaker's own profile. Personal details are withheld when they're private in a shared channel.
export const buildSpeakerProfile = async (ctx: ToolContext): Promise<string> => {
  const botUser = matchedUser(ctx.settings, ctx.identity.username)
  const lines = [
    `Speaker: ${botUser?.name ?? ctx.identity.username} (Discord: ${ctx.identity.username})`,
    botUser ? `Registered Automatarr user${botUser.admin ? ", admin" : ""}` : "Not a registered Automatarr user, so they can't download yet. An admin can !init them.",
    `Preferences: ${describePreferences(ctx.preferences)}`,
  ]

  if (botUser) lines.push(describePool(botUser))

  if (!personalInfoAllowed(ctx)) {
    lines.push("Personal info withheld: they're private and this is a shared channel.")
    return lines.join("\n")
  }

  const memory = await findMemory(ctx.identity.id)
  const history = await getRequestHistory(ctx.identity.id, 20)
  const genres = topGenres(history)

  if (memory?.notes.length) lines.push(`Things you remember: ${memory.notes.map((n) => n.text).join("; ")}`)
  if (genres.length) lines.push(`Favourite genres from requests: ${genres.join(", ")}`)
  if (history.length) {
    lines.push(`Recent requests: ${history.slice(0, 5).map((h) => `${h.action} ${h.title} (${h.year})`).join(", ")}`)
  }

  return lines.join("\n")
}

// Find the Plex account ID linked to the speaker
const speakerPlexAccount = (ctx: ToolContext): number | null => {
  const botUser = matchedUser(ctx.settings, ctx.identity.username)
  if (botUser?.plex_username) return findPlexAccountId([botUser.plex_username])

  return findPlexAccountId([botUser?.name ?? "", ctx.identity.username])
}

// Look up a title in the cached library
const lookupTitle: ToolHandler = async (ctx, input) => {
  const title = inputString(input, "title")
  if (!title) return "A title is required."

  const data = (await Data.findOne()) as dataDocType | null
  const { movies, series } = searchLibraries(data, title, inputYear(input))
  const results = [
    ...movies.map((m) => describeMovie(m, ctx.settings)),
    ...series.map((s) => describeSeries(s, ctx.settings)),
  ]

  return results.length ? results.join("\n") : `Nothing matching "${title}" is in the library.`
}

// Look up any title via the Radarr or Sonarr search, which is backed by TMDB and TVDB
const lookupMedia: ToolHandler = async (ctx, input) => {
  const title = inputString(input, "title")
  if (!title) return "A title is required."

  if (input.type === "series") {
    if (!ctx.settings.sonarr_active) return "Series lookups are unavailable because Sonarr isn't connected."
    const found = (await searchSonarr(ctx.settings, title)) ?? []
    return found.length ? found.slice(0, 3).map((s) => describeSeries(s)).join("\n") : `No series found for "${title}".`
  }

  if (!ctx.settings.radarr_active) return "Film lookups are unavailable because Radarr isn't connected."
  const found = (await searchRadarr(ctx.settings, title)) ?? []
  return found.length ? found.slice(0, 3).map((m) => describeMovie(m)).join("\n") : `No films found for "${title}".`
}

// Get a member's public profile, or the speaker's full profile when no user is given
const getUserProfile: ToolHandler = async (ctx, input) => {
  const identifier = inputString(input, "user", 50)
  if (!identifier) return buildSpeakerProfile(ctx)

  const member = ctx.message.guild ? await matchedDiscordUser(ctx.message, identifier) : undefined
  const username = member?.user.username ?? identifier
  const botUser =
    matchedUser(ctx.settings, username) ??
    ctx.settings.general_bot.users.find((u) => u.name.toLowerCase() === identifier.toLowerCase())

  if (member?.id === ctx.identity.id) return buildSpeakerProfile(ctx)
  if (!botUser) return `${identifier} isn't a registered Automatarr user.`

  // Other people's watch history, habits and memories are never shared
  return `${botUser.name}\n${describePool(botUser)}\n(Their watch history and anything you remember about them is private.)`
}

// What the speaker is watching on Plex right now
const plexNowPlaying: ToolHandler = async (ctx) => {
  if (!personalInfoAllowed(ctx)) return "Withheld: the speaker is private and this is a shared channel."

  const accountId = speakerPlexAccount(ctx)
  if (accountId === null) return "Couldn't match the speaker to a Plex account. An admin can set their Plex username in the web app."

  const playing = await getPlexNowPlaying(ctx.settings, accountId)
  if (!playing.length) return "They aren't watching anything on Plex right now."

  return playing.map((p) => `${describeWatchItem(p)}${p.progress !== null ? `, ${p.progress}% through` : ""}`).join("\n")
}

// What the speaker has watched recently on Plex
const plexRecentHistory: ToolHandler = async (ctx) => {
  if (!personalInfoAllowed(ctx)) return "Withheld: the speaker is private and this is a shared channel."

  const accountId = speakerPlexAccount(ctx)
  if (accountId === null) return "Couldn't match the speaker to a Plex account. An admin can set their Plex username in the web app."

  const history = getCachedPlexHistory(accountId)
  if (!history.length) return "No recent Plex watch history."

  return history.map((h) => `${describeWatchItem(h)}${h.viewed_at ? `, watched ${h.viewed_at.slice(0, 10)}` : ""}`).join("\n")
}

// Handlers for every info tool, keyed by tool name
export const INFO_HANDLERS: Record<string, ToolHandler> = {
  lookup_title: lookupTitle,
  lookup_media: lookupMedia,
  get_user_profile: getUserProfile,
  plex_now_playing: plexNowPlaying,
  plex_recent_history: plexRecentHistory,
}
