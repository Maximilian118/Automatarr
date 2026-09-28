import { EmbedBuilder, User } from "discord.js"
import moment from "moment"
import logger from "../../../logger"
import BotMemory, { BotMemoryType } from "../../../models/botMemory"
import Data, { dataDocType } from "../../../models/data"
import { BotUserType, settingsDocType } from "../../../models/settings"
import { Movie } from "../../../types/movieTypes"
import { Series } from "../../../types/seriesTypes"
import { truncateText } from "../../../shared/utility"
import { findPlexAccountId, getCachedPlexHistory } from "../../../shared/plexRequests"
import { getDiscordClient } from "../discordBot"
import { findChannelByName, getPosterImageUrl, matchedUser } from "../discordBotUtility"
import { aiConfigured } from "./aiClient"
import { budgetExhausted } from "./aiBudget"
import { recordBotReply } from "./aiContext"
import { guardReply } from "./aiGuard"
import { stampMemory } from "./aiMemory"
import { describeMovie, describeSeries, getLibraries } from "./aiMediaFormat"
import { RECOMMENDATION_INSTRUCTIONS } from "./aiPersona"
import { createAIMessage, responseToolCalls } from "./aiRequest"
import { getRequestHistory, topGenres } from "./aiRequestLog"
import { RECOMMEND_TOOL } from "./tools/aiToolDefinitions"

// Recommendations are only sent during sociable hours, server time
const QUIET_HOURS = { start: 22, end: 10 }

// Users must have been active this recently to get recommendations
const ACTIVE_WITHIN_DAYS = 30

// How many candidates the model chooses between
const SHORTLIST_SIZE = 5

// Accent colour for recommendation embeds
const RECOMMENDATION_COLOR = 0xf5c518

type Candidate = { contentType: "movie" | "series"; item: Movie | Series; score: number }

// Check whether it's currently within sociable hours
const withinSociableHours = (): boolean => {
  const hour = moment().hour()
  return hour >= QUIET_HOURS.end && hour < QUIET_HOURS.start
}

// Find the user most overdue a recommendation who is opted in, active and registered
const pickRecipient = async (
  settings: settingsDocType,
): Promise<{ memory: BotMemoryType; botUser: BotUserType } | null> => {
  const activeSince = moment().subtract(ACTIVE_WITHIN_DAYS, "days").format()
  const gapCutoff = moment().subtract(settings.ai_bot.recommendations_gap_days, "days")

  const memories = await BotMemory.find({
    "preferences.recommendations": true,
    last_active_at: { $gte: activeSince },
  }).lean()

  const eligible = memories
    .filter((m) => !m.last_recommended_at || moment(m.last_recommended_at).isBefore(gapCutoff))
    .sort((a, b) => (a.last_recommended_at ?? "").localeCompare(b.last_recommended_at ?? ""))

  for (const memory of eligible) {
    const botUser = matchedUser(settings, memory.username)
    if (botUser) return { memory, botUser }
  }

  return null
}

// Score library items the user hasn't requested or watched, favouring their genres and good ratings
const buildShortlist = async (
  data: dataDocType | null,
  memory: BotMemoryType,
  botUser: BotUserType,
): Promise<{ candidates: Candidate[]; genres: string[] }> => {
  const { movies, series } = getLibraries(data)
  const history = await getRequestHistory(memory.discord_id, 50)
  const plexAccount = findPlexAccountId([botUser.plex_username, botUser.name, memory.username])
  const watched = plexAccount !== null ? getCachedPlexHistory(plexAccount) : []

  const seenMovies = new Set<number>([
    ...botUser.pool.movies.map((m) => m.tmdbId),
    ...history.filter((h) => h.tmdbId).map((h) => Number(h.tmdbId)),
    ...watched.filter((w) => w.tmdbId).map((w) => Number(w.tmdbId)),
  ])
  const seenSeries = new Set<string>([
    ...botUser.pool.series.map((s) => s.title.toLowerCase()),
    ...history.filter((h) => h.content_type === "series").map((h) => h.title.toLowerCase()),
    ...watched.filter((w) => w.show_title).map((w) => String(w.show_title).toLowerCase()),
  ])

  const genres = topGenres([
    ...history,
    ...botUser.pool.movies.map((m) => ({ genres: m.genres ?? [] })),
    ...botUser.pool.series.map((s) => ({ genres: s.genres ?? [] })),
  ])

  const genreScore = (itemGenres: string[] = []): number => itemGenres.filter((g) => genres.includes(g)).length * 2

  const movieCandidates: Candidate[] = movies
    .filter((m) => m.hasFile && !seenMovies.has(m.tmdbId))
    .map((m) => ({
      contentType: "movie" as const,
      item: m,
      score: genreScore(m.genres) + (m.ratings?.rottenTomatoes?.value ?? (m.ratings?.imdb?.value ?? 5) * 10) / 25,
    }))

  const seriesCandidates: Candidate[] = series
    .filter((s) => (s.statistics?.percentOfEpisodes ?? 0) > 0 && !seenSeries.has(s.title.toLowerCase()))
    .map((s) => ({
      contentType: "series" as const,
      item: s,
      score: genreScore(s.genres) + (s.ratings?.value ?? 5) / 2.5,
    }))

  const candidates = [...movieCandidates, ...seriesCandidates]
    .sort((a, b) => b.score - a.score)
    .slice(0, SHORTLIST_SIZE)

  return { candidates, genres }
}

// Ask the model to pick a candidate and write the recommendation
const writeRecommendation = async (
  settings: settingsDocType,
  memory: BotMemoryType,
  candidates: Candidate[],
  genres: string[],
): Promise<{ candidate: Candidate; text: string } | null> => {
  const list = candidates
    .map((c, i) => `${i + 1}. ${c.contentType === "movie" ? describeMovie(c.item as Movie) : describeSeries(c.item as Series)}`)
    .join("\n")

  const likes = [
    genres.length ? `Favourite genres: ${genres.join(", ")}` : "No strong genre preference yet.",
    memory.preferences.learning && memory.notes.length ? `Things you remember: ${memory.notes.map((n) => n.text).join("; ")}` : "",
  ]
    .filter(Boolean)
    .join("\n")

  const response = await createAIMessage(
    settings.ai_bot,
    [{ role: "user", content: `${RECOMMENDATION_INSTRUCTIONS}\n\n<person>\n${likes}\n</person>\n\n<candidates>\n${list}\n</candidates>` }],
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

// Send the recommendation by DM for private users, otherwise in the recommendations channel
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

  const fallbackChannel =
    candidate.contentType === "movie" ? settings.discord_bot.movie_channel_name : settings.discord_bot.series_channel_name
  const { textBasedChannel } = findChannelByName(settings.ai_bot.recommendations_channel || fallbackChannel)
  if (!textBasedChannel) return false

  const sent = await textBasedChannel
    .send({ content: `<@${memory.discord_id}> ${text}`, embeds: [embed], allowedMentions: { users: [memory.discord_id] } })
    .catch(() => null)

  if (sent) recordBotReply(textBasedChannel.id, memory.discord_id, text)
  return !!sent
}

// Send at most one proactive recommendation to the user most overdue one
export const sendRecommendation = async (settings: settingsDocType): Promise<void> => {
  if (!aiConfigured(settings.ai_bot) || !settings.bot_recommendations) return
  if (!withinSociableHours()) return
  if (await budgetExhausted(settings.ai_bot)) return

  const recipient = await pickRecipient(settings)
  if (!recipient) return

  const data = (await Data.findOne()) as dataDocType | null
  const { candidates, genres } = await buildShortlist(data, recipient.memory, recipient.botUser)
  if (!candidates.length) return

  const recommendation = await writeRecommendation(settings, recipient.memory, candidates, genres)
  if (!recommendation) return

  if (await deliverRecommendation(settings, recipient.memory, recommendation.candidate, recommendation.text)) {
    await stampMemory(recipient.memory.discord_id, "last_recommended_at")
    logger.bot(`AI Bot | Recommended ${recommendation.candidate.item.title} to ${recipient.memory.username}`)
  }
}
