import { Message } from "discord.js"
import Settings, { settingsDocType } from "../../../models/settings"
import { Movie } from "../../../types/movieTypes"
import { Series } from "../../../types/seriesTypes"
import { matchedUser, noDBPull } from "../discordBotUtility"
import { findMemory } from "../ai/aiMemory"
import { genreFromText, typeFromText } from "../ai/aiIntent"
import { recommendationEmbed } from "../ai/aiRecommendations"
import { BrowseFilters, BrowseViewer, browseMatches, describeBrowseResult, emptyBrowseFilters } from "../discordBotBrowse"
import { IndexContentType } from "../ai/aiTitleIndex"

// Rule based discovery commands: what's popular on the server and what someone might like.
// No AI involved, so they work whether or not Claude is connected.

// Most recommendations posted at once
const MAX_RECOMMENDATIONS = 3

// The content type a command asks for, or the one its channel is for. Undefined means both.
const requestedType = (message: Message, settings: settingsDocType, args: string): IndexContentType | undefined => {
  const typed = typeFromText(args)
  if (typed) return typed

  const channel = "name" in message.channel ? message.channel.name?.toLowerCase() : ""
  if (channel === settings.discord_bot.movie_channel_name.toLowerCase()) return "movie"
  if (channel === settings.discord_bot.series_channel_name.toLowerCase()) return "series"
  return undefined
}

// The author as a browser. Their own history is only used when they aren't private, as replies are public.
const authorViewer = async (message: Message, settings: settingsDocType): Promise<BrowseViewer> => ({
  settings,
  discordId: message.author.id,
  username: message.author.username,
  personalAllowed: !(await findMemory(message.author.id))?.preferences.private,
})

// The words after the command, e.g. "sci-fi movies" for "!recommend sci-fi movies"
const commandArgs = (message: Message): string => message.content.trim().split(/\s+/).slice(1).join(" ")

// What's been watched most on the server this month, as anonymous counts. Needs Plex.
// Usage: !popular <optional movies|series>
export const casePopular = async (message: Message): Promise<string> => {
  const settings = (await Settings.findOne()) as settingsDocType
  if (!settings) return noDBPull()
  if (!settings.plex_active) return "`!popular` needs Plex to be connected, so I can see what people are watching."

  const filters: BrowseFilters = { ...emptyBrowseFilters(), type: requestedType(message, settings, commandArgs(message)), popular: true }
  const { results } = await browseMatches(await authorViewer(message, settings), filters)
  if (!results.length) return "Nobody has watched anything on the server this month. Yet."

  const lines = results.map((r, i) => `${i + 1}. ${describeBrowseResult(r, filters)}`)
  return `🔥 **Most watched on the server this month**\n${lines.join("\n")}`
}

// Why a recommendation suits someone, e.g. "Matches your Sci-Fi and Thriller taste · 🍅 92%"
const recommendationReason = (type: IndexContentType, item: Movie | Series, tasteGenres: string[]): string => {
  const shared = (item.genres ?? []).filter((g) => tasteGenres.includes(g)).slice(0, 2)
  const movieRating = (item as Movie).ratings?.rottenTomatoes?.value
  const seriesRating = (item as Series).ratings?.value
  const rating =
    type === "movie" ? (movieRating ? `🍅 ${movieRating}%` : "") : seriesRating ? `⭐ ${seriesRating}/10` : ""

  return [shared.length ? `Matches your ${shared.join(" and ")} taste` : "", rating].filter(Boolean).join(" · ")
}

// Recommend downloaded titles the author hasn't watched, requested or pooled, best for their taste first.
// Usage: !recommend <optional movies|series> <optional genre>
export const caseRecommend = async (message: Message): Promise<string> => {
  const settings = (await Settings.findOne()) as settingsDocType
  if (!settings) return noDBPull()

  const args = commandArgs(message)
  const filters: BrowseFilters = {
    ...emptyBrowseFilters(),
    type: requestedType(message, settings, args),
    genre: genreFromText(args),
    unseen: true,
  }

  const { results, taste } = await browseMatches(await authorViewer(message, settings), filters)
  if (!results.length) {
    return filters.genre
      ? `I couldn't find any ${filters.genre} on the server that you haven't already seen.`
      : "I couldn't find anything on the server that you haven't already seen."
  }

  const picks = results.slice(0, MAX_RECOMMENDATIONS)
  const embeds = picks.map(({ entry }) => {
    const embed = recommendationEmbed({ contentType: entry.type, item: entry.item, score: 0 })
    const reason = recommendationReason(entry.type, entry.item, taste?.genres ?? [])
    return reason ? embed.setFooter({ text: reason }) : embed
  })

  const intro = matchedUser(settings, message.author.username) && taste
    ? `🎯 Picked for <@${message.author.id}> from what's on the server:`
    : "🎯 Some of the best rated things on the server:"

  if ("send" in message.channel) await message.channel.send({ content: intro, embeds, allowedMentions: { users: [] } })
  return ""
}
