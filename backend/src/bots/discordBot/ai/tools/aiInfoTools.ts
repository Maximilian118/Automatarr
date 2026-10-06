import moment from "moment"
import { BotUserType } from "../../../../models/settings"
import { Movie } from "../../../../types/movieTypes"
import { Series } from "../../../../types/seriesTypes"
import { searchRadarr } from "../../../../shared/RadarrStarrRequests"
import { searchSonarr } from "../../../../shared/SonarrStarrRequests"
import {
  describeWatchItem,
  getCachedPlexHistory,
  getPlexNowPlaying,
  hasWatchedOnPlex,
  plexAccountForUser,
  titleKey,
} from "../../../../shared/plexRequests"
import { matchedDiscordUser, matchedUser } from "../../discordBotUtility"
import { describeBrief, describeItem, ratingOutOf10 } from "../aiMediaFormat"
import { getDownloadSnapshot, queueStatusText, searchingKeys } from "../../../../shared/downloadStatus"
import { RecipientProfile, buildProfile, hasSeen, isDownloaded, scoreFor } from "../aiRecommendations"
import {
  IndexContentType,
  IndexedTitle,
  MATCH_THRESHOLD,
  buildQuery,
  ensureTitleIndex,
  indexTitle,
  indexedTitles,
  scoreItem,
  scoreTitle,
  searchTitleIndex,
} from "../aiTitleIndex"
import { describePreferences, findMemory, findMemoryByUsernames } from "../aiMemory"
import { getRequestHistory, topGenres } from "../aiRequestLog"
import { unlinkedPlexHint } from "./aiPlexTools"
import { ToolContext, ToolHandler, ToolInput, inputBoolean, inputString, inputYear } from "./aiToolTypes"

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

// How many recent Plex watches are shared when describing someone else's taste
const SHARED_WATCH_COUNT = 5

// Describe someone else's taste from their requests and Plex history. Only used for members who aren't private.
const describeTaste = async (discordId: string | null, botUser: BotUserType): Promise<string[]> => {
  const genres = discordId ? topGenres(await getRequestHistory(discordId, 20)) : []
  const accountId = plexAccountForUser(botUser, botUser.ids[0] ?? "")
  const watched = accountId !== null ? getCachedPlexHistory(accountId).slice(0, SHARED_WATCH_COUNT) : []

  return [
    genres.length ? `Favourite genres from requests: ${genres.join(", ")}` : "",
    watched.length ? `Recently watched on Plex: ${watched.map(describeWatchItem).join(", ")}` : "",
  ].filter(Boolean)
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

  // What they call the bot isn't personal, so it's always shown
  const memory = await findMemory(ctx.identity.id)
  if (memory?.bot_nicknames?.length) {
    lines.push(`Names they call you, Automatarr (never call them these): ${memory.bot_nicknames.join(", ")}`)
  }

  if (!personalInfoAllowed(ctx)) {
    lines.push("Personal info withheld: they're private and this is a shared channel.")
    return lines.join("\n")
  }

  if (memory?.nicknames?.length) lines.push(`Names to call them: ${memory.nicknames.join(", ")}`)

  const history = await getRequestHistory(ctx.identity.id, 20)
  const genres = topGenres(history)

  if (memory?.notes.length) lines.push(`Things you remember about them: ${memory.notes.map((n) => n.text).join("; ")}`)
  if (genres.length) lines.push(`Favourite genres from requests: ${genres.join(", ")}`)
  if (history.length) {
    lines.push(`Recent requests (past actions, not their current pool): ${history.slice(0, 5).map((h) => `${h.action} ${h.title} (${h.year})`).join(", ")}`)
  }

  return lines.join("\n")
}

// Find the Plex account ID linked to the speaker
const speakerPlexAccount = (ctx: ToolContext): number | null =>
  plexAccountForUser(matchedUser(ctx.settings, ctx.identity.username), ctx.identity.username)

// Most results find_title returns
const MAX_FIND_RESULTS = 5

// Most online lookup results considered per content type
const MAX_ONLINE_RESULTS = 8

// Short overviews are only added when there are this few results, to keep long lists cheap
const OVERVIEW_RESULT_LIMIT = 2
const SHORT_OVERVIEW_LENGTH = 120

// A library match good enough that an online lookup can't add anything
const CONFIDENT_SCORE = 100

// Lowest score an online result keeps, so TMDB's own fuzzy matches still show after closer ones
const ONLINE_FLOOR_SCORE = 10

// A film or series found by find_title, from the library or an online lookup
export type FoundTitle = { type: IndexContentType; item: Movie | Series; score: number }

// The TMDB or TVDB ID that identifies a title across the library and online lookups
const externalKey = (found: FoundTitle): string =>
  `${found.type}:${found.type === "movie" ? found.item.tmdbId : (found.item as Series).tvdbId}`

// Search TMDB or TVDB through Radarr or Sonarr, scored the same way as library matches.
// Results that are already in the library come back with their library ID, which also refreshes the index.
const lookupOnline = async (
  ctx: ToolContext,
  type: IndexContentType,
  title: string,
  year?: number,
): Promise<FoundTitle[]> => {
  const active = type === "movie" ? ctx.settings.radarr_active : ctx.settings.sonarr_active
  if (!active) return []

  const found: (Movie | Series)[] =
    (type === "movie" ? await searchRadarr(ctx.settings, title) : await searchSonarr(ctx.settings, title)) ?? []
  const query = buildQuery(title, year)

  return found.slice(0, MAX_ONLINE_RESULTS).map((item) => {
    if (item.id) indexTitle(type, item)
    return { type, item, score: Math.max(scoreItem(item, query), ONLINE_FLOOR_SCORE) }
  })
}

// Merge library and online results, keeping one of each title. Online copies are fresher, so they win
// when they show a download the library copy doesn't know about yet.
const mergeResults = (library: FoundTitle[], online: FoundTitle[]): FoundTitle[] => {
  const merged = new Map<string, FoundTitle>()

  for (const found of [...library, ...online]) {
    const key = externalKey(found)
    const existing = merged.get(key)
    if (!existing) merged.set(key, found)
    else if ("hasFile" in found.item && found.item.hasFile && !(existing.item as Movie).hasFile) {
      merged.set(key, { ...existing, item: { ...existing.item, hasFile: true } as Movie })
    }
  }

  return [...merged.values()].sort((a, b) => b.score - a.score).slice(0, MAX_FIND_RESULTS)
}

// Whether a found title is in the library but not fully downloaded, so its queue is worth checking
const awaitingDownload = (found: FoundTitle): boolean =>
  !!found.item.id &&
  (found.type === "movie"
    ? !(found.item as Movie).hasFile
    : ((found.item as Series).statistics?.percentOfEpisodes ?? 0) < 100)

// Describe found titles for the model, one line each, with live download progress for anything
// still downloading and whether the speaker has watched it. Overviews are optional to keep lists cheap.
export const describeFoundTitles = async (
  ctx: ToolContext,
  found: FoundTitle[],
  withOverview: boolean,
): Promise<string[]> => {
  const waiting = found.filter(awaitingDownload)
  const snapshot = waiting.length ? await getDownloadSnapshot(ctx.settings, [...new Set(waiting.map((r) => r.type))]) : null
  const searching = waiting.length ? await searchingKeys() : new Set<string>()
  const plexAccount = personalInfoAllowed(ctx) ? speakerPlexAccount(ctx) : null

  return found.map((r) =>
    describeItem(r.type, r.item, {
      settings: ctx.settings,
      queue: snapshot && awaitingDownload(r) ? queueStatusText(snapshot, searching, r.type, r.item.id).toLowerCase() : "",
      watched: hasWatchedOnPlex(plexAccount, r.type, r.item.title),
      overviewLength: withOverview ? SHORT_OVERVIEW_LENGTH : 0,
    }),
  )
}

// Find a film or series anywhere: the library first, then TMDB or TVDB for anything not in it.
// One call answers "is X on the server?", "is X out yet?", "how long is X?" and "which X do they mean?".
const findTitle: ToolHandler = async (ctx, input) => {
  const title = inputString(input, "title")
  if (!title) return "A title is required."

  const year = inputYear(input)
  const type = input.type === "movie" || input.type === "series" ? input.type : undefined
  const types: IndexContentType[] = type ? [type] : ["movie", "series"]

  await ensureTitleIndex()
  const library: FoundTitle[] = searchTitleIndex(title, { year, type, limit: MAX_FIND_RESULTS })
  const confident = (library[0]?.score ?? 0) >= CONFIDENT_SCORE + (year ? 20 : 0)
  const online = confident ? [] : (await Promise.all(types.map((t) => lookupOnline(ctx, t, title, year)))).flat()
  const results = mergeResults(library, online)

  if (!results.length) {
    const web = ctx.settings.ai_bot.web_search ? " If it's very new, try web_lookup." : ""
    return `No film or series called "${title}" in the library or on TMDB/TVDB. It may be spelt differently.${web}`
  }

  return (await describeFoundTitles(ctx, results, results.length <= OVERVIEW_RESULT_LIMIT)).join("\n")
}

// Most titles browse_library returns
const MAX_BROWSE_RESULTS = 8

// Read a positive number from tool input. 0 when missing or invalid.
const inputNumber = (input: ToolInput, key: string): number => {
  const value = Number(input[key])
  return Number.isFinite(value) && value > 0 ? value : 0
}

// Build the speaker's taste profile for ranking and seen checks. Null when they aren't registered
// or are private in a shared channel, in which case browsing ignores their history.
const speakerTaste = async (ctx: ToolContext): Promise<RecipientProfile | null> => {
  const botUser = matchedUser(ctx.settings, ctx.identity.username)
  if (!botUser || !personalInfoAllowed(ctx)) return null

  const memory = await findMemory(ctx.identity.id)
  return memory ? buildProfile(memory, botUser) : null
}

// Check a library title against the browse filters
const passesBrowseFilters = (
  entry: IndexedTitle,
  filters: { type?: string; genre: string; keyword: string; recentDays: number; minRating: number },
): boolean => {
  const { item } = entry
  if (filters.type && entry.type !== filters.type) return false
  if (!isDownloaded(entry.type, item)) return false
  if (filters.genre && !(item.genres ?? []).some((g) => g.toLowerCase().includes(filters.genre))) return false
  if (filters.recentDays && moment().diff(moment(item.added), "days") > filters.recentDays) return false
  if (filters.minRating && ratingOutOf10(entry.type, item) < filters.minRating) return false

  if (filters.keyword) {
    const collection = "collection" in item ? (item.collection?.title ?? "") : ""
    const query = buildQuery(filters.keyword)
    const inCollection = !!collection && titleKey(collection).includes(query.key)
    if (!inCollection && scoreTitle({ ...entry, year: item.year }, query) < MATCH_THRESHOLD) return false
  }

  return true
}

// Browse what's downloaded on the server by genre, franchise, recency or rating, optionally leaving out
// what the speaker has already seen. Ranked by the speaker's taste when it's known.
const browseLibrary: ToolHandler = async (ctx, input) => {
  await ensureTitleIndex()

  const filters = {
    type: input.type === "movie" || input.type === "series" ? input.type : undefined,
    genre: inputString(input, "genre", 30).toLowerCase(),
    keyword: inputString(input, "keyword", 50),
    recentDays: inputNumber(input, "recent_days"),
    minRating: inputNumber(input, "min_rating"),
  }

  const taste = await speakerTaste(ctx)
  const unseen = inputBoolean(input, "unseen") === true && !!taste

  const matches = indexedTitles()
    .filter((e) => passesBrowseFilters(e, filters))
    .filter((e) => !unseen || !taste || !hasSeen(taste, e.type, e.item))

  if (!matches.length) return "Nothing downloaded on the server matches that."

  const ranked = filters.recentDays
    ? matches.sort((a, b) => moment(b.item.added).valueOf() - moment(a.item.added).valueOf())
    : matches.sort((a, b) =>
        taste
          ? scoreFor(taste, b.type, b.item) - scoreFor(taste, a.type, a.item)
          : ratingOutOf10(b.type, b.item) - ratingOutOf10(a.type, a.item),
      )

  const note = inputBoolean(input, "unseen") && !unseen ? " (couldn't check what they've seen)" : ""
  return [
    `${matches.length} match${matches.length === 1 ? "" : "es"}${note}, best first:`,
    ...ranked.slice(0, MAX_BROWSE_RESULTS).map((e) => describeBrief(e.type, e.item)),
  ].join("\n")
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

  const profile = [botUser.name, describePool(botUser)]
  const memory = member ? await findMemory(member.id) : await findMemoryByUsernames(botUser.ids)

  // Taste is only shared for members who aren't private. Remembered facts are never shared.
  if (memory?.preferences.private) {
    profile.push("They keep their viewing private, so their taste and watch history aren't shared.")
  } else {
    const taste = await describeTaste(member?.id ?? memory?.discord_id ?? null, botUser)
    profile.push(...(taste.length ? taste : ["No taste info yet."]))
  }

  profile.push("(Anything you remember about them is private.)")
  return profile.join("\n")
}

// What the speaker is watching on Plex right now
const plexNowPlaying: ToolHandler = async (ctx) => {
  if (!personalInfoAllowed(ctx)) return "Withheld: the speaker is private and this is a shared channel."

  const accountId = speakerPlexAccount(ctx)
  if (accountId === null) return unlinkedPlexHint(ctx)

  const playing = await getPlexNowPlaying(ctx.settings, accountId)
  if (!playing.length) return "They aren't watching anything on Plex right now."

  return playing.map((p) => `${describeWatchItem(p)}${p.progress !== null ? `, ${p.progress}% through` : ""}`).join("\n")
}

// What the speaker has watched recently on Plex
const plexRecentHistory: ToolHandler = async (ctx) => {
  if (!personalInfoAllowed(ctx)) return "Withheld: the speaker is private and this is a shared channel."

  const accountId = speakerPlexAccount(ctx)
  if (accountId === null) return unlinkedPlexHint(ctx)

  const history = getCachedPlexHistory(accountId)
  if (!history.length) return "No recent Plex watch history."

  return history.map((h) => `${describeWatchItem(h)}${h.viewed_at ? `, watched ${h.viewed_at.slice(0, 10)}` : ""}`).join("\n")
}

// Handlers for every info tool, keyed by tool name
export const INFO_HANDLERS: Record<string, ToolHandler> = {
  find_title: findTitle,
  browse_library: browseLibrary,
  get_user_profile: getUserProfile,
  plex_now_playing: plexNowPlaying,
  plex_recent_history: plexRecentHistory,
}
