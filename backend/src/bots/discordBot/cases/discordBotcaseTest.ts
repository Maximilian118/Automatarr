import { Message } from "discord.js"
import Settings, { settingsDocType } from "../../../models/settings"
import {
  noDBPull,
  createWebhookEmbed,
} from "../discordBotUtility"
import {
  randomGrabbedMessage,
  randomGrabNotFoundMessage,
  randomMovieReadyMessage,
  randomSeriesReadyMessage,
  randomMovieReplacementMessage,
  randomEpisodeReplacementMessage,
} from "../discordBotRandomReply"
import Data, { dataDocType } from "../../../models/data"
import logger from "../../../logger"
import { Movie } from "../../../types/movieTypes"
import { Series } from "../../../types/seriesTypes"
import { WebHookWaitingType } from "../../../models/webhook"
import { isMovie, isSeries } from "../../../types/typeGuards"

// Test webhook notifications with fake data
export const caseTest = async (message: Message): Promise<string> => {
  const args = message.content.trim().split(/\s+/)
  const [, eventType] = args

  if (!eventType) {
    return "Usage: `!test <eventType>` where eventType is: downloading, ready, upgrade, expired"
  }

  // Accept both old technical terms and new friendly terms for compatibility
  const eventMapping: Record<string, string> = {
    grab: "grab",
    downloading: "grab",
    import: "import",
    ready: "import",
    upgrade: "upgrade",
    expired: "expired",
  }

  const lowerEventType = eventType.toLowerCase()
  const mappedEventType = eventMapping[lowerEventType]

  if (!mappedEventType) {
    return `Invalid event type. Use one of: downloading, ready, upgrade, expired`
  }

  try {
    // Get settings to check channel restrictions
    const settings = (await Settings.findOne()) as settingsDocType
    if (!settings) return noDBPull()

    // Check which channel we're in to determine content type
    const channel = message.channel
    if (!("name" in channel) || !channel.name) {
      return "This command can only be used in a named server channel."
    }

    // Get random content from database
    const data = (await Data.findOne()) as dataDocType
    if (!data) return noDBPull()

    const movieLibrary = data.libraries.find((API) => API.name === "Radarr")?.data as
      | Movie[]
      | undefined
    const seriesLibrary = data.libraries.find((API) => API.name === "Sonarr")?.data as
      | Series[]
      | undefined

    let randomContent: Movie | Series | null = null

    // Respect channel type - only movies in movie channel, only series in series channel
    if (channel.name.toLowerCase() === settings.discord_bot.movie_channel_name.toLowerCase()) {
      // Movie channel - only return movies
      if (movieLibrary && movieLibrary.length > 0) {
        randomContent = movieLibrary[Math.floor(Math.random() * movieLibrary.length)]
      } else {
        return "No movies found in database to test with. Try adding some movies first!"
      }
    } else if (
      channel.name.toLowerCase() === settings.discord_bot.series_channel_name.toLowerCase()
    ) {
      // Series channel - only return series
      if (seriesLibrary && seriesLibrary.length > 0) {
        randomContent = seriesLibrary[Math.floor(Math.random() * seriesLibrary.length)]
      } else {
        return "No series found in database to test with. Try adding some series first!"
      }
    } else {
      // Other channels - allow both but prefer based on availability
      if (movieLibrary && movieLibrary.length > 0 && seriesLibrary && seriesLibrary.length > 0) {
        const useMovie = Math.random() > 0.5
        if (useMovie) {
          randomContent = movieLibrary[Math.floor(Math.random() * movieLibrary.length)]
        } else {
          randomContent = seriesLibrary[Math.floor(Math.random() * seriesLibrary.length)]
        }
      } else if (movieLibrary && movieLibrary.length > 0) {
        randomContent = movieLibrary[Math.floor(Math.random() * movieLibrary.length)]
      } else if (seriesLibrary && seriesLibrary.length > 0) {
        randomContent = seriesLibrary[Math.floor(Math.random() * seriesLibrary.length)]
      }
    }

    if (!randomContent) {
      return "No content found in database to test with. Try adding some movies or series first!"
    }

    // Generate appropriate message using existing random functions
    let testMessage: string
    if (mappedEventType === "grab") {
      testMessage = randomGrabbedMessage(randomContent.title)
    } else if (mappedEventType === "import") {
      if (isMovie(randomContent)) {
        testMessage = randomMovieReadyMessage(message.author.toString(), randomContent.title)
      } else if (isSeries(randomContent)) {
        testMessage = randomSeriesReadyMessage(message.author.toString(), randomContent.title)
      } else {
        testMessage = "Test import message"
      }
    } else if (mappedEventType === "upgrade") {
      if (isMovie(randomContent)) {
        testMessage = randomMovieReplacementMessage(randomContent.title)
      } else if (isSeries(randomContent)) {
        testMessage = randomEpisodeReplacementMessage(randomContent.title, 1, 1) // placeholder season/episode
      } else {
        testMessage = "Test upgrade message"
      }
    } else {
      testMessage = "Test notification message"
    }

    // Create fake webhook data
    const fakeWebhookMatch: WebHookWaitingType = {
      APIName: "runtime" in randomContent ? "Radarr" : "Sonarr",
      bots: ["Discord"],
      discordData: {
        guildId: message.guild?.id ?? "",
        channelId: message.channel.id,
        authorId: message.author.id,
        authorUsername: message.author.username,
        authorMention: message.author.toString(),
        messageId: message.id,
      },
      whatsappData: null,
      content: randomContent,
      seasons: [],
      episodes: [],
      waitForStatus:
        mappedEventType === "grab"
          ? "Grab"
          : mappedEventType === "import"
          ? "Import"
          : mappedEventType === "upgrade"
          ? "Upgrade"
          : "Import",
      status:
        mappedEventType === "grab"
          ? "downloading"
          : mappedEventType === "expired"
          ? "not_found"
          : "ready",
      message: testMessage,
      created_at: new Date(),
    }

    // Generate test webhook notification
    const isExpired = mappedEventType === "expired"
    let finalMessage = fakeWebhookMatch.message

    if (isExpired) {
      // Use randomGrabNotFoundMessage for expired notifications
      finalMessage = randomGrabNotFoundMessage(randomContent.title)
    }

    const embed = createWebhookEmbed(fakeWebhookMatch, finalMessage, isExpired)

    // Send the test embed
    if ("send" in message.channel && typeof message.channel.send === "function") {
      await message.channel.send({ embeds: [embed] })
      return "" // Return empty string to avoid double-sending
    }

    return "Could not send test notification - channel type not supported"
  } catch (err) {
    logger.error(`caseTest error: ${err}`)
    return "Error generating test notification"
  }
}
