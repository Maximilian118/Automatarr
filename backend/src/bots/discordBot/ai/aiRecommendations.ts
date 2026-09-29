import { EmbedBuilder, User } from "discord.js"
import moment from "moment"
import logger from "../../../logger"
import AIState, { AIStateType } from "../../../models/aiState"
import BotMemory, { BotMemoryType } from "../../../models/botMemory"
import { BotUserType, settingsDocType } from "../../../models/settings"
import { Movie } from "../../../types/movieTypes"
import { Series } from "../../../types/seriesTypes"
import { truncateText } from "../../../shared/utility"
import { plexAccountForUser, getCachedPlexHistory } from "../../../shared/plexRequests"
import { getDiscordClient } from "../discordBot"
import { findChannelByName, getPosterImageUrl, matchedUser } from "../discordBotUtility"
import { aiConfigured } from "./aiClient"
import { budgetExhausted } from "./aiBudget"
import { recordBotReply } from "./aiContext"
import { guardReply } from "./aiGuard"
import { stampMemory } from "./aiMemory"
import { describeMovie, describeSeries } from "./aiMediaFormat"
import { RECOMMENDATION_INSTRUCTIONS } from "./aiPersona"
import { createAIMessage, responseToolCalls } from "./aiRequest"
import { getRequestHistory, topGenres } from "./aiRequestLog"
import { RECOMMEND_TOOL } from "./tools/aiToolDefinitions"

// Recommendations are only sent during sociable hours, server time
const SOCIABLE_HOURS = { start: 10, end: 22 }

// Users must have been active this recently to get recommendations
const ACTIVE_WITHIN_DAYS = 30

// The same person gets at most one recommendation in this many days
const PER_PERSON_GAP_DAYS = 30

// Server-wide, the gap after a recommendation is a random number of days in this range,
// so recommendations feel organic: roughly twice a week at most, once a month at least
const SERVER_GAP_DAYS = { min: 3.5, max: 30 }

// Minimum ratings for something to be worth recommending
const RATING_FLOOR = { rottenTomatoes: 60, imdb: 6.5, series: 7 }

// Accent colour for recommendation embeds
const RECOMMENDATION_COLOR = 0xf5c518

export type ContentType = "movie" | "series"

export type Candidate = { contentType: ContentType; item: Movie | Series; score: number }

// Everything needed to judge whether something suits a person
export type RecipientProfile = {
  memory: BotMemoryType
  botUser: BotUserType
  genres: string[] // Their favourite genres, most common first
  seenMovies: Set<number> // TMDB IDs they've requested, have in their pool or watched on Plex
  seenSeries: Set<string> // Lowercased titles of series they've requested, have or watched
}

// Get the server-wide AI state, creating it if needed
const getAIState = async (): Promise<AIStateType> => {
  const state = await AIState.findOneAndUpdate({}, { $setOnInsert: { pending_arrivals: [] } }, { upsert: true, new: true })
  return state.toObject()
}

// Check whether it's currently within sociable hours
const withinSociableHours = (): boolean => {
  const hour = moment().hour()
  return hour >= SOCIABLE_HOURS.start && hour < SOCIABLE_HOURS.end
}

// Check every server-wide condition for sending a recommendation right now
export const canRecommend = async (settings: settingsDocType): Promise<boolean> => {
  if (!aiConfigured(settings.ai_bot) || !settings.ai_bot.recommendations) return false
  if (!withinSociableHours()) return false

  const state = await getAIState()
  if (state.next_recommendation_at && moment().isBefore(moment(state.next_recommendation_at))) return false

  return !(await budgetExhausted(settings.ai_bot))
}

// Pick when the next recommendation may be sent, somewhere between a few days and a month away
export const nextRecommendationTime = (): string => {
  const days = SERVER_GAP_DAYS.min + Math.random() * (SERVER_GAP_DAYS.max - SERVER_GAP_DAYS.min)
  return moment().add(days * 24 * 60, "minutes").format()
}

// Check whether a person is allowed a recommendation: opted in, active recently, not recommended to lately
export const personEligible = (memory: BotMemoryType): boolean => {
  if (!memory.preferences.recommendations || !memory.last_active_at) return false
  if (moment().diff(moment(memory.last_active_at), "days") > ACTIVE_WITHIN_DAYS) return false

  return !memory.last_recommended_at || moment().diff(moment(memory.last_recommended_at), "days") >= PER_PERSON_GAP_DAYS
}

// Get every registered, eligible person who could receive a recommendation
export const eligibleMemories = async (
  settings: settingsDocType,
): Promise<{ memory: BotMemoryType; botUser: BotUserType }[]> => {
  const memories = await BotMemory.find({ "preferences.recommendations": true }).lean()

  return memories
    .filter(personEligible)
    .map((memory) => ({ memory, botUser: matchedUser(settings, memory.username) }))
    .filter((r): r is { memory: BotMemoryType; botUser: BotUserType } => !!r.botUser)
}

// Build a person's taste profile from their pool, request history and Plex history
export const buildProfile = async (memory: BotMemoryType, botUser: BotUserType): Promise<RecipientProfile> => {
  const history = await getRequestHistory(memory.discord_id, 50)
  const plexAccount = plexAccountForUser(botUser, memory.username)
  const watched = plexAccount !== null ? getCachedPlexHistory(plexAccount) : []

  return {
    memory,
    botUser,
    genres: topGenres([
      ...history,
      ...botUser.pool.movies.map((m) => ({ genres: m.genres ?? [] })),
      ...botUser.pool.series.map((s) => ({ genres: s.genres ?? [] })),
    ]),
    seenMovies: new Set<number>([
      ...botUser.pool.movies.map((m) => m.tmdbId),
      ...history.filter((h) => h.tmdbId).map((h) => Number(h.tmdbId)),
      ...watched.filter((w) => w.tmdbId).map((w) => Number(w.tmdbId)),
    ]),
    seenSeries: new Set<string>([
      ...botUser.pool.series.map((s) => s.title.toLowerCase()),
      ...history.filter((h) => h.content_type === "series").map((h) => h.title.toLowerCase()),
      ...watched.filter((w) => w.show_title).map((w) => String(w.show_title).toLowerCase()),
    ]),
  }
}

// Check whether a person has already requested, pooled or watched something
export const hasSeen = (profile: RecipientProfile, contentType: ContentType, item: Movie | Series): boolean =>
  contentType === "movie" ? profile.seenMovies.has(item.tmdbId) : profile.seenSeries.has(item.title.toLowerCase())

// Count how many of a person's favourite genres an item has
export const genreOverlap = (profile: RecipientProfile, item: Movie | Series): number =>
  (item.genres ?? []).filter((g) => profile.genres.includes(g)).length

// Check whether an item is downloaded and ready to watch
export const isDownloaded = (contentType: ContentType, item: Movie | Series): boolean =>
  contentType === "movie" ? !!(item as Movie).hasFile : ((item as Series).statistics?.percentOfEpisodes ?? 0) > 0

// Check whether an item is rated well enough to be worth recommending
export const passesRatingFloor = (contentType: ContentType, item: Movie | Series): boolean => {
  if (contentType === "series") return ((item as Series).ratings?.value ?? 0) >= RATING_FLOOR.series

  const ratings = (item as Movie).ratings
  return (
    (ratings?.rottenTomatoes?.value ?? 0) >= RATING_FLOOR.rottenTomatoes ||
    (ratings?.imdb?.value ?? 0) >= RATING_FLOOR.imdb
  )
}

// Score an item for a person: genre matches count most, ratings break ties
export const scoreFor = (profile: RecipientProfile, contentType: ContentType, item: Movie | Series): number => {
  const rating =
    contentType === "movie"
      ? ((item as Movie).ratings?.rottenTomatoes?.value ?? ((item as Movie).ratings?.imdb?.value ?? 5) * 10) / 25
      : ((item as Series).ratings?.value ?? 5) / 2.5

  return genreOverlap(profile, item) * 2 + rating
}

// Ask the model to pick a candidate and write the recommendation
const writeRecommendation = async (
  settings: settingsDocType,
  profile: RecipientProfile,
  candidates: Candidate[],
  reason: string,
): Promise<{ candidate: Candidate; text: string } | null> => {
  const list = candidates
    .map((c, i) => `${i + 1}. ${c.contentType === "movie" ? describeMovie(c.item as Movie) : describeSeries(c.item as Series)}`)
    .join("\n")

  const { memory, genres } = profile
  const likes = [
    genres.length ? `Favourite genres: ${genres.join(", ")}` : "No strong genre preference yet.",
    memory.preferences.learning && memory.notes.length ? `Things you remember: ${memory.notes.map((n) => n.text).join("; ")}` : "",
  ]
    .filter(Boolean)
    .join("\n")

  const response = await createAIMessage(
    settings.ai_bot,
    [
      {
        role: "user",
        content: `${RECOMMENDATION_INSTRUCTIONS}\n\n<reason>${reason}</reason>\n\n<person>\n${likes}\n</person>\n\n<candidates>\n${list}\n</candidates>`,
      },
    ],
    [RECOMMEND_TOOL],
  )

  const call = responseToolCalls(response).find((c) => c.name === "recommend")
  const input = (call?.input ?? {}) as { candidate?: unknown; message?: unknown }
  const candidate = candidates[Number(input.candidate) - 1]
  const text = typeof input.message === "string" ? guardReply(input.message) : ""

  return candidate && text ? { candidate, text } : null
}

// Build the recommendation embed with the poster and a copyable download command
const recommendationEmbed = (candidate: Candidate): EmbedBuilder => {
  const { item } = candidate
  const embed = new EmbedBuilder()
    .setColor(RECOMMENDATION_COLOR)
    .setTitle(`${item.title} (${item.year})`)
    .setDescription([truncateText(item.overview, 200), `Add it to your pool: \`!d ${item.title} ${item.year}\``].filter(Boolean).join("\n\n"))

  const poster = getPosterImageUrl(item.images)
  if (poster) embed.setThumbnail(poster)

  return embed
}

// Send a recommendation by DM for private users, otherwise in the matching movie or series channel
const deliverRecommendation = async (
  settings: settingsDocType,
  memory: BotMemoryType,
  candidate: Candidate,
  text: string,
): Promise<boolean> => {
  const client = getDiscordClient()
  if (!client) return false

  const embed = recommendationEmbed(candidate)

  if (memory.preferences.private) {
    const user: User | null = await client.users.fetch(memory.discord_id).catch(() => null)
    if (!user) return false

    const dm = await user.send({ content: text, embeds: [embed] }).catch(() => null)
    if (dm) recordBotReply(dm.channel.id, memory.discord_id, text)
    return !!dm
  }

  const { movie_channel_name, series_channel_name } = settings.discord_bot
  const { textBasedChannel } = findChannelByName(candidate.contentType === "movie" ? movie_channel_name : series_channel_name)
  if (!textBasedChannel) return false

  const sent = await textBasedChannel
    .send({ content: `<@${memory.discord_id}> ${text}`, embeds: [embed], allowedMentions: { users: [memory.discord_id] } })
    .catch(() => null)

  if (sent) recordBotReply(textBasedChannel.id, memory.discord_id, text)
  return !!sent
}

// Write and send a recommendation, then hold off further recommendations server-wide.
// Returns whether it was sent.
export const recommend = async (
  settings: settingsDocType,
  profile: RecipientProfile,
  candidates: Candidate[],
  reason: string,
): Promise<boolean> => {
  const recommendation = await writeRecommendation(settings, profile, candidates, reason)
  if (!recommendation) return false

  const sent = await deliverRecommendation(settings, profile.memory, recommendation.candidate, recommendation.text)
  if (!sent) return false

  await stampMemory(profile.memory.discord_id, "last_recommended_at")
  await AIState.updateOne({}, { $set: { next_recommendation_at: nextRecommendationTime(), updated_at: moment().format() } })
  logger.bot(`AI Bot | Recommended ${recommendation.candidate.item.title} to ${profile.memory.username}`)

  return true
}
