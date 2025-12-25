import { Message } from "discord.js"
import Settings, { settingsDocType } from "../../../models/settings"
import {
  discordReply,
  matchedDiscordUser,
  matchedUser,
  noDBPull,
  noDBSave,
  normalizeForComparison,
  sendDiscordMessage,
} from "../discordBotUtility"
import { validateRemoveCommand } from "../validate/validateRemoveCommand"
import { checkUserMovieLimit, checkUserSeriesLimit } from "../discordBotUserLimits"
import { randomProcessingMessage, randomRemovalSuccessMessage } from "../discordBotRandomReply"
import { saveWithRetry } from "../../../shared/database"
import { Movie } from "../../../types/movieTypes"
import { Series } from "../../../types/seriesTypes"
import { cancelWebhooksForContent } from "../../../webhooks/webhookUtility"

// Remove an item from the users pool
export const caseRemove = async (message: Message): Promise<string> => {
  await sendDiscordMessage(message, randomProcessingMessage())

  const settings = (await Settings.findOne()) as settingsDocType
  if (!settings) return noDBPull()

  // Validate the request string: `!remove <Index/Title + Year>`
  const parsed = await validateRemoveCommand(message, settings)
  if (typeof parsed === "string") return parsed

  const { channel, poolItemTitle, contentTitle, contentYear, contentType } = parsed

  if (!("name" in channel) || !channel.name) {
    return "Wups! This command can only be used in a named server channel."
  }

  // Get guildMember while checking if <discord_username> exists on the server
  const guildMember = await matchedDiscordUser(message, message.author.username)
  if (!guildMember) return `The user \`${message.author.username}\` does not exist in this server.`
  const username = guildMember.user.username

  // Get user while checking if user exists in the database
  let user = matchedUser(settings, username)
  if (!user) return `A Discord user by <@${guildMember.id}> does not exist in the database.`

  const plural = contentType === "movie" ? "movies" : "series"

  // Find the content to be removed for webhook cancellation
  let removedContent: Movie | Series | null = null

  // Use normalized comparison for fuzzy matching
  const normalizedTitle = contentTitle ? normalizeForComparison(contentTitle) : null

  if (channel.name === settings.discord_bot.movie_channel_name) {
    removedContent =
      user.pool.movies.find((m) => {
        if (normalizedTitle !== null && contentYear !== null) {
          return (
            normalizeForComparison(m.title) === normalizedTitle &&
            Number(m.year) === Number(contentYear)
          )
        }
        return `${m.title} ${m.year}` === poolItemTitle
      }) || null
  } else if (channel.name === settings.discord_bot.series_channel_name) {
    removedContent =
      user.pool.series.find((s) => {
        if (normalizedTitle !== null && contentYear !== null) {
          return (
            normalizeForComparison(s.title) === normalizedTitle &&
            Number(s.year) === Number(contentYear)
          )
        }
        return `${s.title} ${s.year}` === poolItemTitle
      }) || null
  }

  // Remove from the user's pool
  const originalPoolSize =
    contentType === "movie" ? user.pool.movies.length : user.pool.series.length

  settings.general_bot.users = settings.general_bot.users.map((u) => {
    if (user && u._id !== user._id) return u

    const pool = u.pool
    // Use normalized comparison for fuzzy matching, fallback to string comparison for index-based removal
    const updatedMovies =
      channel.name === settings.discord_bot.movie_channel_name
        ? pool.movies.filter((m) => {
            if (normalizedTitle !== null && contentYear !== null) {
              return !(
                normalizeForComparison(m.title) === normalizedTitle &&
                Number(m.year) === Number(contentYear)
              )
            }
            return `${m.title} ${m.year}` !== poolItemTitle
          })
        : pool.movies

    const updatedSeries =
      channel.name === settings.discord_bot.series_channel_name
        ? pool.series.filter((s) => {
            if (normalizedTitle !== null && contentYear !== null) {
              return !(
                normalizeForComparison(s.title) === normalizedTitle &&
                Number(s.year) === Number(contentYear)
              )
            }
            return `${s.title} ${s.year}` !== poolItemTitle
          })
        : pool.series

    const newUser = {
      ...u,
      pool: {
        ...pool,
        movies: updatedMovies,
        series: updatedSeries,
      },
    }

    user = newUser
    return newUser
  })

  // Check if anything was actually removed
  const newPoolSize = contentType === "movie" ? user.pool.movies.length : user.pool.series.length

  if (originalPoolSize === newPoolSize) {
    // Show user's current pool as suggestions
    const currentPool = contentType === "movie" ? user.pool.movies : user.pool.series
    const suggestions = currentPool.map((item) => `${item.title} ${item.year}`).join("\n")

    return (
      `I couldn't find "${poolItemTitle}" in your ${plural} pool.\n\n` +
      (suggestions
        ? `Your current ${plural}:\n${suggestions}`
        : `You don't have any ${plural} in your pool.`)
    )
  }

  // Cancel any pending webhooks for the removed content
  if (removedContent) {
    await cancelWebhooksForContent(removedContent)
  }

  // Save the new pool data to the database
  if (!(await saveWithRetry(settings, "caseRemove"))) return noDBSave()

  const { currentLeft } =
    contentType === "movie"
      ? checkUserMovieLimit(user, settings)
      : checkUserSeriesLimit(user, settings)

  return discordReply(
    randomRemovalSuccessMessage(poolItemTitle, contentType),
    "success",
    `${user.name} | Removed a ${contentType} | ${poolItemTitle} | They have ${currentLeft} pool allowance available for ${plural}.`,
  )
}
