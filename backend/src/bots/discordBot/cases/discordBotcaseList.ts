import { Message, EmbedBuilder } from "discord.js"
import Settings, { settingsDocType } from "../../../models/settings"
import {
  findChannelByName,
  matchedDiscordUser,
  matchedUser,
  noDBPull,
  createPoolItemEmbed,
} from "../discordBotUtility"
import { validateListCommand } from "../validate/validateListCommand"
import { checkUserMovieLimit, checkUserSeriesLimit } from "../discordBotUserLimits"
import logger from "../../../logger"

// List items in a users pool
export const caseList = async (message: Message): Promise<string> => {
  const settings = (await Settings.findOne()) as settingsDocType
  if (!settings) return noDBPull()

  // Get the channel used
  const channel = message.channel

  if (!("name" in channel) || !channel.name) {
    return "Wups! This command can only be used in a named server channel."
  }

  const isMovieChannel =
    channel.name.toLowerCase() === settings.discord_bot.movie_channel_name.toLowerCase()
  const isSeriesChannel =
    channel.name.toLowerCase() === settings.discord_bot.series_channel_name.toLowerCase()

  // Validate the request string: `!list <optional_contentType> <optional_discord_username> <optional_basic>`
  const msgArr = message.content.slice().trim().split(/\s+/)
  const validationError = validateListCommand(msgArr)
  if (validationError) return validationError

  // Check for "basic" flag in any position after !list
  const isBasicMode = msgArr.includes("basic")

  // Define valid content types for parsing
  const validContentTypes = ["pool", "movie", "movies", "series"]

  // Extract target user from anywhere in the arguments (excluding "basic" and content types)
  const userParam = msgArr
    .slice(1) // Skip the command
    .find((arg) => {
      const argLower = arg.toLowerCase()
      return !validContentTypes.includes(argLower) && argLower !== "basic"
    })
  const targetUser = userParam || message.author.username
  const guildMember = await matchedDiscordUser(message, targetUser)
  if (!guildMember) return `The user \`${targetUser}\` does not exist in this server.`
  const username = guildMember.user.username

  // Find the target user in the database
  const user = matchedUser(settings, username)
  if (!user) return `A Discord user by <@${guildMember.id}> does not exist in the database.`

  // Extract contentType from anywhere in the arguments (excluding "basic" and "@usernames")
  const contentTypeParam = msgArr
    .slice(1) // Skip the command
    .find((arg) => {
      const argLower = arg.toLowerCase()
      return validContentTypes.includes(argLower)
    })
  const contentType = contentTypeParam?.toLowerCase() as
    | "pool"
    | "movie"
    | "movies"
    | "series"
    | undefined

  // If channels exist extreact mentions for better discord UX
  const { mention: movieChannel } = findChannelByName(settings.discord_bot.movie_channel_name)
  const { mention: seriesChannel } = findChannelByName(settings.discord_bot.series_channel_name)

  // Get the maximums for the user
  const { currentMovieMax } = checkUserMovieLimit(user, settings)
  const { currentSeriesMax } = checkUserSeriesLimit(user, settings)

  // Determine what content to show based on explicit contentType or channel context
  const shouldShowMovies = (!contentType && isMovieChannel) || contentType?.includes("movie")
  const shouldShowSeries = (!contentType && isSeriesChannel) || contentType === "series"
  const shouldShowBoth =
    (!contentType && !isMovieChannel && !isSeriesChannel) || contentType === "pool"

  // Check if user has too many items - force basic mode for >20 movies or series
  const hasMany = user.pool.movies.length > 20 || user.pool.series.length > 20

  // Handle basic mode - return old text-based format
  if (isBasicMode || hasMany) {
    // Add notification for auto-downgrade
    const downgradedMessage =
      hasMany && !isBasicMode
        ? `ℹ️ **Large pool detected (>20 items) - showing in basic text format for better performance**\n\n`
        : ""
    const moviesList =
      user.pool.movies.length === 0
        ? `No Movies yet! ${
            !userParam
              ? `Use the !download command in the ${movieChannel} channel to download your first movie!`
              : ""
          }`
        : user.pool.movies.map((movie, i) => `${i + 1}. ${movie.title} ${movie.year}`).join("\n") +
          `\n(Maximum: ${currentMovieMax})`

    const movies = `Movies:\n` + moviesList + "\n"

    const seriesList =
      user.pool.series.length === 0
        ? `No Series yet! ${
            !userParam
              ? `Use the !download command in the ${seriesChannel} channel to download your first series!`
              : ""
          }`
        : user.pool.series
            .map((series, i) => `${i + 1}. ${series.title} ${series.year}`)
            .join("\n") + `\n(Maximum: ${currentSeriesMax})`

    const series = `Series:\n` + seriesList + "\n"

    return (
      downgradedMessage +
      `🎞️ Content Pool for <@${guildMember.id}>\n` +
      `\n` +
      (shouldShowBoth
        ? `${movies}\n` + series
        : shouldShowMovies
        ? movies
        : shouldShowSeries
        ? series
        : "")!
    )
  }

  // Helper function to determine pool limit color based on usage
  const getPoolLimitColor = (currentCount: number, maxLimit: number): number => {
    if (maxLimit === 0) return 0x95a5a6 // Gray for unlimited

    const usagePercent = (currentCount / maxLimit) * 100

    if (usagePercent >= 100) return 0xff4444 // Red - at/over limit
    if (usagePercent >= 76) return 0xff8c00 // Orange - close to limit
    return 0x32cd32 // Green - plenty of space
  }

  // Rich embed mode - split into multiple messages if needed
  const headerColor = 0x3498db // Blue for headers and limits

  if ("send" in message.channel && typeof message.channel.send === "function") {
    let messageCount = 0

    // Helper function to send message with embeds
    const sendEmbedMessage = async (embeds: EmbedBuilder[], isFirst: boolean = false) => {
      if ("send" in message.channel && typeof message.channel.send === "function") {
        const content = isFirst ? `🎞️ **Content Pool for <@${guildMember.id}>**` : ""
        await message.channel.send({ content, embeds })
        messageCount++
      }
    }

    // Process movies
    if (shouldShowBoth || shouldShowMovies) {
      if (user.pool.movies.length === 0) {
        // Empty movies embed
        const emptyEmbed = new EmbedBuilder()
          .setColor(headerColor)
          .setTitle("🎬 Movies")
          .setDescription(
            `No Movies yet! ${
              !userParam && movieChannel
                ? `Use the !download command in ${movieChannel} to download your first movie!`
                : "This user has no movies in their pool."
            }`,
          )
        await sendEmbedMessage([emptyEmbed], messageCount === 0)
      } else {
        // Split movies into chunks of 8 for multiple messages
        const movieChunks: any[][] = []
        for (let i = 0; i < user.pool.movies.length; i += 8) {
          movieChunks.push(user.pool.movies.slice(i, i + 8))
        }

        for (let chunkIndex = 0; chunkIndex < movieChunks.length; chunkIndex++) {
          const chunk = movieChunks[chunkIndex]
          const movieEmbeds = chunk.map((movie, i) =>
            createPoolItemEmbed(movie, i + chunkIndex * 8, "movie"),
          )
          await sendEmbedMessage(movieEmbeds, messageCount === 0)
        }

        // Add movie pool limit as separate message with dynamic color
        const movieLimitColor = getPoolLimitColor(user.pool.movies.length, Number(currentMovieMax))
        const movieLimitEmbed = new EmbedBuilder()
          .setColor(movieLimitColor)
          .setTitle(`Movies Pool Limit: ${user.pool.movies.length}/${currentMovieMax}`)
        await sendEmbedMessage([movieLimitEmbed], messageCount === 0)
      }
    }

    // Process series
    if (shouldShowBoth || shouldShowSeries) {
      if (user.pool.series.length === 0) {
        // Empty series embed
        const emptyEmbed = new EmbedBuilder()
          .setColor(headerColor)
          .setTitle("📺 Series")
          .setDescription(
            `No Series yet! ${
              !userParam && seriesChannel
                ? `Use the !download command in ${seriesChannel} to download your first series!`
                : "This user has no series in their pool."
            }`,
          )
        await sendEmbedMessage([emptyEmbed], messageCount === 0)
      } else {
        // Split series into chunks of 8 for multiple messages
        const seriesChunks: any[][] = []
        for (let i = 0; i < user.pool.series.length; i += 8) {
          seriesChunks.push(user.pool.series.slice(i, i + 8))
        }

        for (let chunkIndex = 0; chunkIndex < seriesChunks.length; chunkIndex++) {
          const chunk = seriesChunks[chunkIndex]
          const seriesEmbeds = chunk.map((series, i) =>
            createPoolItemEmbed(series, i + chunkIndex * 8, "series"),
          )
          await sendEmbedMessage(seriesEmbeds, messageCount === 0)
        }

        // Add series pool limit as separate message with dynamic color
        const seriesLimitColor = getPoolLimitColor(
          user.pool.series.length,
          Number(currentSeriesMax),
        )
        const seriesLimitEmbed = new EmbedBuilder()
          .setColor(seriesLimitColor)
          .setTitle(`Series Pool Limit: ${user.pool.series.length}/${currentSeriesMax}`)
        await sendEmbedMessage([seriesLimitEmbed], messageCount === 0)
      }
    }

    return "" // Return empty to prevent additional message
  } else {
    logger.warn("caseList: Channel does not support sending embeds")
    return "Unable to send rich content in this channel type."
  }
}
