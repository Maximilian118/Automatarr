import { Message } from "discord.js"
import RequestLog, { RequestLogAction, RequestLogType } from "../../../models/requestLog"
import { Movie } from "../../../types/movieTypes"
import { Series } from "../../../types/seriesTypes"
import logger from "../../../logger"
import { getPreferences } from "./aiMemory"

// Append a request to a user's request history, respecting their learning preference.
// Never throws so it can't interrupt the command that called it.
export const logRequest = async (
  message: Message,
  contentType: "movie" | "series",
  item: Movie | Series,
  action: RequestLogAction,
): Promise<void> => {
  try {
    const prefs = await getPreferences(message.author.id)
    if (!prefs.learning) return

    await RequestLog.create({
      discord_id: message.author.id,
      username: message.author.username,
      content_type: contentType,
      title: item.title,
      year: Number(item.year) || 0,
      tmdbId: item.tmdbId ?? null,
      tvdbId: "tvdbId" in item ? item.tvdbId ?? null : null,
      genres: item.genres ?? [],
      action,
    })
  } catch (err) {
    logger.error(`AI Bot | Failed to log request for ${message.author.username}: ${err}`)
  }
}

// Get a user's most recent request history, newest first
export const getRequestHistory = async (
  discordId: string,
  limit: number = 20,
): Promise<RequestLogType[]> =>
  RequestLog.find({ discord_id: discordId }).sort({ created_at: -1 }).limit(limit).lean()

// Count how often each genre appears in a user's requests, most common first
export const topGenres = (history: { genres: string[] }[], limit: number = 5): string[] => {
  const counts = new Map<string, number>()

  history.forEach((h) => h.genres.forEach((g) => counts.set(g, (counts.get(g) ?? 0) + 1)))

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([genre]) => genre)
}
