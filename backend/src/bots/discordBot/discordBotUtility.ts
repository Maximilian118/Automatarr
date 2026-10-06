import type { PoolItemStatus } from "./discordBotPoolStatus"
import {
  Client,
  Guild,
  GuildBasedChannel,
  GuildMember,
  GuildTextBasedChannel,
  Message,
  EmbedBuilder,
  MessageMentionOptions,
} from "discord.js"
import Settings, { DiscordBotType, settingsDocType, BotUserType } from "../../models/settings"
import logger from "../../logger"
import { QualityProfile } from "../../types/qualityProfileType"
import { dataDocType } from "../../models/data"
import { DownloadStatus, rootFolderData } from "../../types/types"
import { formatBytes, formatRuntime, truncateText } from "../../shared/utility"
import moment from "moment"
import { getDiscordClient } from "./discordBot"
import { WebHookWaitingType } from "../../models/webhook"
import { isTextBasedChannel } from "./discordBotTypeGuards"
import { isMovie, isSeries } from "../../types/typeGuards"
import { Series } from "../../types/seriesTypes"
import { Movie } from "../../types/movieTypes"
import { randomProcessingMessage, randomQualityNotFoundMessage } from "./discordBotRandomReply"
import { isAICommandMessage } from "./ai/aiCommandMessage"
import { recordBotReply, recordUserEvent } from "./ai/aiContext"

// Handle errors
export const handleDiscordErrors = (client: Client) => {
  client.on("error", (err) => {
    logger.catastrophic(`Error event caught: ${err}`)
  })

  client.on("shardError", (err) => {
    logger.catastrophic(`Shard Error event caught: ${err}`)
  })
}

export const initDiscordBot = (discord_bot: DiscordBotType): DiscordBotType => {
  return {
    ...discord_bot,
    ready: false,
    token: "",
    server_list: [],
    server_name: "",
    channel_list: [],
    movie_channel_name: "",
    series_channel_name: "",
    music_channel_name: "",
    books_channel_name: "",
  }
}

// Split a message into chunks that fit within Discord's 2000 character limit
// Splits on newlines to avoid breaking mid-line
const splitMessage = (content: string, limit: number = 2000): string[] => {
  if (content.length <= limit) return [content]

  const chunks: string[] = []
  let remaining = content

  while (remaining.length > 0) {
    if (remaining.length <= limit) {
      chunks.push(remaining)
      break
    }

    // Find the last newline within the limit
    let splitIndex = remaining.lastIndexOf("\n", limit)

    // If no newline found, split at the limit
    if (splitIndex <= 0) {
      splitIndex = limit
    }

    chunks.push(remaining.slice(0, splitIndex))
    remaining = remaining.slice(splitIndex + 1)
  }

  return chunks
}

// A function for type safety with message.channel.send()
// Automatically splits messages exceeding Discord's 2000 character limit.
// Every reply is recorded against the author so they can carry on chatting with the AI.
export const sendDiscordMessage = async (
  message: Message,
  content: string,
  allowedMentions?: MessageMentionOptions, // Restrict who a message may ping. Used for AI replies.
): Promise<void> => {
  // Skip sending if content is empty or just whitespace
  if (!content || content.trim() === "") {
    return
  }

  if ("send" in message.channel && typeof message.channel.send === "function") {
    try {
      const chunks = splitMessage(content)

      for (const chunk of chunks) {
        await message.channel.send(allowedMentions ? { content: chunk, allowedMentions } : chunk)
      }

      recordBotReply(message.channel.id, message.author.id, content)
    } catch (err) {
      logger.error(`sendDiscordMessage: Failed to send message: ${err}`)
    }
  } else {
    logger.warn(`safeSend: Channel is not text-based. Could not send message: "${content}"`)
  }
}

// Let a user know a slow command is underway. Skipped for commands the AI runs, because the AI
// already shows a typing indicator and replies once at the end. Not recorded in the AI's history,
// since "working on it" tells it nothing.
export const sendProcessingMessage = async (message: Message): Promise<void> => {
  if (isAICommandMessage(message)) return
  if (!("send" in message.channel) || typeof message.channel.send !== "function") return

  try {
    await message.channel.send(randomProcessingMessage())
  } catch (err) {
    logger.error(`sendProcessingMessage: Failed to send message: ${err}`)
  }
}

// Note a sent notification for the user who asked for the download, so the AI knows about it
// next time they chat, e.g. that a film has landed
const noteNotificationForAI = (webhookMatch: WebHookWaitingType, message: string): void => {
  const userId = webhookMatch.discordData?.authorId
  if (userId) recordUserEvent(userId, `A notification about ${webhookMatch.content.title} was posted for them: "${message}"`)
}

export const sendDiscordNotification = async (
  webhookMatch: WebHookWaitingType,
  expired?: boolean,
): Promise<{ success: boolean; messageId?: string }> => {
  const client = getDiscordClient()

  if (!client) {
    logger.error("sendDiscordNotification: Could not get Discord Client")
    return { success: false }
  }

  if (!webhookMatch.discordData) {
    logger.error("sendDiscordNotification: No discordData.")
    return { success: false }
  }

  let channel

  try {
    channel = await client.channels.fetch(webhookMatch.discordData.channelId)
  } catch (err) {
    logger.error(
      `sendDiscordNotification: Failed to fetch channel ${
        webhookMatch.discordData.channelId
      }: ${String(err)}`,
    )
    return { success: false }
  }

  const textBasedChannel = isTextBasedChannel(channel)

  if (!textBasedChannel) {
    logger.error(
      `sendDiscordNotification: Channel is not text-based: ${webhookMatch.discordData.channelId}`,
    )
    return { success: false }
  }

  try {
    const expiredMessage = webhookMatch.expired_message
      ? webhookMatch.expired_message
      : `Hmm... I didn't get any notification information of status ${
          webhookMatch.waitForStatus
        } for ${webhookMatch.content.title} after ${moment(webhookMatch.expiry).format(
          "dddd, MMMM Do YYYY, h:mm A",
        )}.`

    const message = expired ? expiredMessage : webhookMatch.message
    const embed = createWebhookEmbed(webhookMatch, message, expired)

    // Check if we should edit an existing message or send a new one
    if (webhookMatch.sentMessageId) {
      try {
        // Try to edit existing message
        const existingMessage = await textBasedChannel.messages.fetch(webhookMatch.sentMessageId)
        await existingMessage.edit({ embeds: [embed] })

        logger.bot(
          `Webhook | ${expired ? "Expiry | " : ""}Discord Message Edited | ${
            webhookMatch.waitForStatus
          } | ${webhookMatch.discordData.authorUsername} | ${
            webhookMatch.content.title
          } | ${webhookMatch.sentMessageId}`,
        )

        // For "Ready" or "Not Found" notifications, also send a follow-up message
        // This creates a fresh notification for the user (especially if the old message is buried)
        const shouldSendFollowUp =
          webhookMatch.waitForStatus === "Import" ||
          webhookMatch.waitForStatus === "Upgrade" ||
          expired === true

        if (shouldSendFollowUp && webhookMatch.discordData.authorMention) {
          try {
            const { authorMention } = webhookMatch.discordData
            const followUpMessage = message.includes(authorMention) ? message : `${authorMention}, ${message}`
            await textBasedChannel.send(followUpMessage)

            logger.bot(
              `Webhook | Follow-up Message Sent | ${webhookMatch.waitForStatus} | ${
                webhookMatch.discordData.authorUsername
              } | ${webhookMatch.content.title}`,
            )
          } catch (followUpErr) {
            logger.warn(
              `sendDiscordNotification: Failed to send follow-up message: ${String(followUpErr)}`,
            )
            // Don't fail the whole operation if follow-up fails
          }
        }

        noteNotificationForAI(webhookMatch, message)
        return { success: true, messageId: webhookMatch.sentMessageId }
      } catch (editErr) {
        logger.warn(
          `sendDiscordNotification: Failed to edit message ${webhookMatch.sentMessageId}, sending new message instead: ${String(editErr)}`,
        )
        // Fall through to send new message
      }
    }

    // Send new message (either first time or fallback from edit failure)
    const sentMessage = await textBasedChannel.send({ embeds: [embed] })

    if (sentMessage) {
      logger.bot(
        `Webhook | ${expired ? "Expiry | " : ""}Discord Notification Sent | ${
          webhookMatch.waitForStatus
        } | ${webhookMatch.discordData.authorUsername} | ${
          webhookMatch.content.title
        } | ${sentMessage.id}`,
      )

      noteNotificationForAI(webhookMatch, message)
      return { success: true, messageId: sentMessage.id }
    }
  } catch (err) {
    logger.error(
      `sendDiscordNotification: Failed to send message to ${
        webhookMatch.discordData.channelId
      }: ${String(err)}`,
    )
  }

  return { success: false }
}

// A basic function that returns the passed string and logs it in the backend
export const discordReply = (
  msg: string,
  level: "catastrophic" | "error" | "warn" | "debug" | "info" | "success" | "bot",
  customLog?: string,
): string => {
  const logMessage = `Discord Bot | ${customLog || msg}`

  if (typeof logger[level] === "function") {
    logger.bot(logMessage) // changed to bot instead of logger[level]
  } else {
    logger.info(logMessage)
  }

  return msg
}

export const noDBPull = () =>
  discordReply("I couldn't connect to the database. Please try again.", "error")
export const noDBSave = () =>
  discordReply("I couldn't save to the databse. Please try again.", "error")

// Function to check if the message sender is an admin
export const adminCheck = async (
  message: Message,
  passedSettings?: settingsDocType,
): Promise<string> => {
  const settings = passedSettings ? passedSettings : ((await Settings.findOne()) as settingsDocType)
  if (!settings) return noDBPull()

  const sender = settings.general_bot.users.find((u) =>
    u.ids.some((id) => id === message.author.username),
  )

  if (!sender) {
    return discordReply(
      "You are not a registered user. Please refer to an admin.",
      "error",
      `${message.author.username} is not a user and failed admin check for command: ${message}`,
    )
  }

  if (!sender.admin) {
    return discordReply(
      `You are not an admin ${sender.name}...`,
      "error",
      `${message.author.username} failed admin check for command: ${message}`,
    )
  }

  return ""
}

// Check if the server owner is the target
export const ownerIsTarget = (
  settings: settingsDocType,
  message: Message,
  targetUsername: string,
  action?: string,
): string => {
  const serverOwner = settings.general_bot.users[0]

  // If !serverOwner then no users exist
  if (!serverOwner) {
    return "You first need to create a user in the database with `!init <discord_username> <display_name>`."
  }

  // The server owner has been targeted
  if (serverOwner.ids.includes(targetUsername)) {
    return discordReply(
      `${serverOwner.name} the supreme does not have time for your shenanigans.`,
      "warn",
      `${message.author.username} just attempted to ${
        action ? action : "do something silly to"
      } the server owner...`,
    )
  }

  return ""
}

// Get all Servers
export const getAllGuilds = async (client: Client): Promise<Guild[]> => {
  const guilds: Guild[] = []

  for (const [, partialGuild] of client.guilds.cache) {
    try {
      const fullGuild = await partialGuild.fetch()
      guilds.push(fullGuild)
    } catch (err) {
      logger.error(`Failed to fetch guild ${partialGuild.id}:`, err)
    }
  }

  return guilds
}

// Get all Channels
export const getAllChannels = async (
  client: Client,
  guildName?: string,
): Promise<GuildBasedChannel[]> => {
  const allChannels: GuildBasedChannel[] = []

  for (const [, guild] of client.guilds.cache) {
    try {
      const fetchedGuild = await guild.fetch()

      // If a guildName is provided, skip other guilds
      if (guildName && fetchedGuild.name !== guildName) {
        continue
      }

      const channels = await fetchedGuild.channels.fetch()
      channels.forEach((channel) => {
        if (channel) {
          allChannels.push(channel)
        }
      })

      // If filtering by guildName, we can return early
      if (guildName) break
    } catch (err) {
      logger.error(`Failed to fetch channels for guild ${guild.id}:`, err)
    }
  }

  return allChannels
}

// Find the GuildTextBasedChannel that matches a passed string
export const findChannelByName = (
  channelName: string,
): {
  textBasedChannel: GuildTextBasedChannel | undefined
  mention: string
  error: string
} => {
  if (!channelName) {
    return {
      textBasedChannel: undefined,
      mention: channelName,
      error: "",
    }
  }

  const client = getDiscordClient()

  if (!client) {
    return {
      textBasedChannel: undefined,
      mention: channelName,
      error: discordReply(`Umm... no client found. This is bad.`, "error"),
    }
  }

  const channel = client.channels.cache.find(
    (ch): ch is GuildTextBasedChannel =>
      ch.isTextBased?.() && "name" in ch && ch.name === channelName,
  )

  return {
    textBasedChannel: channel,
    mention: channel ? `<#${channel.id}>` : channelName,
    error: "",
  }
}

// Get Members for a specific Server
export const getAllMembersForGuild = async (
  client: Client,
  guildId: string,
): Promise<GuildMember[]> => {
  try {
    const guild = await client.guilds.fetch(guildId)

    // Fetch all members (requires privileged intent)
    const members = await guild.members.fetch()

    return Array.from(members.values())
  } catch (err) {
    logger.error(`Error fetching members for guild ${guildId}:`, err)
    return []
  }
}

// Return servers. If a server is selected, return all channels of that server.
export const getServerandChannels = async (
  client: Client,
  settings: settingsDocType,
): Promise<settingsDocType> => {
  const guilds = await getAllGuilds(client)

  if (guilds.length === 0) {
    logger.warn("Discord Bot | No Servers.")
    return settings
  }

  settings.discord_bot.server_list = guilds.map((server) => server.name)

  if (!settings.discord_bot.server_name) {
    logger.warn("Discord Bot | Please select a Server!")
    return settings
  }

  if (!settings.discord_bot.server_list.includes(settings.discord_bot.server_name)) {
    logger.warn(
      `Discord Bot | The selected Server "${settings.discord_bot.server_name}" does not exist.`,
    )
    return settings
  }

  const channels = await getAllChannels(client, settings.discord_bot.server_name)

  if (channels.length === 0) {
    logger.warn(`Discord Bot | No Channels found for Server "${settings.discord_bot.server_name}".`)
    return settings
  }

  settings.discord_bot.channel_list = channels.map((channel) => channel.name)

  if (!settings.discord_bot.movie_channel_name && !settings.discord_bot.series_channel_name) {
    logger.warn("Discord Bot | Please select a Channel!")
  }

  return settings
}

// Check if the passed Discord mentionMatch/username exists in the server
export const matchedDiscordUser = async (
  message: Message,
  identifier: string,
): Promise<GuildMember | undefined> => {
  const guild = message.guild
  if (!guild) return undefined

  // A mention like <@123> or a bare user ID
  const idMatch = identifier.match(/^<@!?(\d+)>$/) ?? identifier.match(/^(\d{15,20})$/)

  if (idMatch) {
    const member = guild.members.cache.get(idMatch[1])
    return member
  }

  const id = identifier.replace(/^@/, "").trim().toLowerCase()

  // Usernames are unique, so they win over display names and nicknames
  const byUsername = guild.members.cache.find(
    (m) => m.user.username.toLowerCase() === id || m.user.tag.toLowerCase() === id,
  )
  if (byUsername) return byUsername

  return guild.members.cache.find((m) =>
    [m.displayName, m.nickname, m.user.globalName].some((n) => n?.toLowerCase() === id),
  )
}

// Replace user and channel mentions in a message with readable names, e.g. <@123> becomes @Tanox
export const resolveMentions = (message: Message): string =>
  message.content
    .replace(/<@!?(\d+)>/g, (raw, id: string) => {
      const member = message.mentions.members?.get(id)
      const user = message.mentions.users.get(id)
      const name = member?.displayName ?? user?.globalName ?? user?.username
      return name ? `@${name}` : raw
    })
    .replace(/<#(\d+)>/g, (raw, id: string) => {
      const channel = message.mentions.channels.get(id)
      return channel && "name" in channel && channel.name ? `#${channel.name}` : raw
    })

// Check if the passed Discord username exists as a user in Automatarr already
export const matchedUser = (
  settings: settingsDocType,
  identifier: string,
): BotUserType | undefined =>
  settings.general_bot.users.find((u) => u.ids.some((id) => id === identifier))

// Alias groups mapping user input to keywords for matching against quality profile names
export const qualityAliases: Record<string, string[]> = {
  "4k": ["4k", "2160", "2160p", "2160i", "uhd", "ultra"],
  "1080": ["1080", "1080p", "1080i", "fhd", "fullhd", "full-hd"],
  "720": ["720", "720p", "720i"],
  "480": ["480", "480p", "480i", "sd"],
}

// Find the quality alias group (e.g. "4k", "1080") that a user's quality argument belongs to
export const getQualityGroup = (qualityArg: string): string | undefined => {
  const normalizedArg = qualityArg.toLowerCase().trim()

  return Object.entries(qualityAliases).find(([, aliases]) => aliases.includes(normalizedArg))?.[0]
}

// Map a Starr app quality resolution (e.g. 2160) to its quality alias group (e.g. "4k")
export const resolutionToQualityGroup = (resolution?: number): string | undefined => {
  if (!resolution) return
  if (resolution >= 2160) return "4k"
  if (resolution >= 1080) return "1080"
  if (resolution >= 720) return "720"

  return "480"
}

// Match a user's quality argument (e.g., "4k", "1080p") to an available quality profile
export const findQualityProfileByAlias = (
  qualityArg: string,
  data: dataDocType,
  APIName: "Radarr" | "Sonarr" | "Lidarr",
): QualityProfile | string => {
  const qualityProfiles = data.qualityProfiles.find((qp) => qp.name === APIName)

  if (!qualityProfiles) {
    return `It looks like the quality profiles data isn't initialised for ${APIName}. Curious...`
  }

  // Find which alias group the user's input belongs to
  const matchedGroup = getQualityGroup(qualityArg)

  if (!matchedGroup) {
    const profileNames = qualityProfiles.data.map((qp) => qp.name)
    return randomQualityNotFoundMessage(qualityArg, profileNames)
  }

  // Search all profiles for any whose name contains a keyword from this alias group
  const keywords = qualityAliases[matchedGroup]
  const matchedProfiles = qualityProfiles.data.filter((qp) => {
    const profileNameLower = qp.name.toLowerCase()
    return keywords.some((keyword) => profileNameLower.includes(keyword))
  })

  if (matchedProfiles.length === 0) {
    const profileNames = qualityProfiles.data.map((qp) => qp.name)
    return randomQualityNotFoundMessage(qualityArg, profileNames)
  }

  return matchedProfiles[0]
}

// Find a quality profile in the database by name
export const findQualityProfile = (
  qpName: string,
  data: dataDocType,
  APIName: "Radarr" | "Sonarr" | "Lidarr",
): QualityProfile | string => {
  const qualityProfiles = data.qualityProfiles.find((qp) => qp.name === APIName)

  if (!qualityProfiles) {
    return `It looks like the quality profiles data isn't initialised for ${APIName}. Curious...`
  }

  const matchedQualityProfiles = qualityProfiles.data.filter((qp) => qp.name === qpName)

  if (matchedQualityProfiles.length === 0) {
    return `I can't find a quality profile named "${qpName}" for ${APIName}. We must inform the server owner at once!`
  }

  if (matchedQualityProfiles.length > 1) {
    return `I've found multiple quality profiles with the name "${qpName}". Please ensure quality profile names are unique!`
  }

  return matchedQualityProfiles[0]
}

// Find the root path for a specific API
export const findRootFolder = (
  data: dataDocType,
  APIName: "Radarr" | "Sonarr" | "Lidarr",
): rootFolderData | string => {
  const APIRootFolder = data.rootFolders.find((rf) => rf.name === APIName)

  if (!APIRootFolder) {
    return `It looks like the root folder data isn't initialised for ${APIName}. Curious...`
  }

  if (!APIRootFolder.data) {
    return `I couldn't find any root folder data for ${APIName}!`
  }

  if (!APIRootFolder.data.path) {
    return `There's no root folder path selected in ${APIName}!?`
  }

  if (!APIRootFolder.data.freeSpace) {
    return `I see no root folder freeSpace data for ${APIName}!?`
  }

  return APIRootFolder.data
}

// Check the amount of free space is more than the minimum selected
export const freeSpaceCheck = (freeSpace: number, minFreeSpace: string | number): string => {
  let minBytes: bigint

  if (typeof minFreeSpace === "string") {
    if (!/^\d+$/.test(minFreeSpace.trim())) {
      return "Minimum free space must be a valid number string."
    }
    minBytes = BigInt(minFreeSpace.trim())
  } else if (typeof minFreeSpace === "number") {
    minBytes = BigInt(Math.floor(minFreeSpace))
  } else {
    return "Minimum free space is of an unsupported type."
  }

  const free = BigInt(Math.floor(freeSpace))

  if (free <= minBytes) {
    const formattedMin = formatBytes(minBytes, 2)
    const formattedFree = formatBytes(free, 2)
    return `Oops! Not enough free space. At least ${formattedMin} is required, but only ${formattedFree} is available.`
  }

  return ""
}

// Find the queue item with the longest downlaod time
export const getQueueItemWithLongestTimeLeft = (
  queue: DownloadStatus[],
): DownloadStatus | undefined => {
  if (!queue.length) return

  return queue.reduce((max, current) => {
    const maxMs = moment.duration(max.timeleft).asMilliseconds()
    const currentMs = moment.duration(current.timeleft).asMilliseconds()

    return currentMs > maxMs ? current : max
  })
}

// Get poster image URL from movie/series, prioritizing poster type
export const getPosterImageUrl = (images: any[]): string | null => {
  if (!images || images.length === 0) return null

  // Priority: poster > banner > any other image
  const poster = images.find(img => img.coverType === "poster")
  if (poster?.remoteUrl || poster?.url) return poster.remoteUrl || poster.url

  const banner = images.find(img => img.coverType === "banner")
  if (banner?.remoteUrl || banner?.url) return banner.remoteUrl || banner.url

  // Fallback to first available image
  const fallback = images.find(img => img.remoteUrl || img.url)
  return fallback?.remoteUrl || fallback?.url || null
}

// Get backdrop/fanart image URL from movie/series for large bottom image
export const getBackdropImageUrl = (images: any[]): string | null => {
  if (!images || images.length === 0) return null

  // Priority: fanart > backdrop > banner (for wide landscape images)
  const fanart = images.find(img => img.coverType === "fanart")
  if (fanart?.remoteUrl || fanart?.url) return fanart.remoteUrl || fanart.url

  const backdrop = images.find(img => img.coverType === "backdrop")
  if (backdrop?.remoteUrl || backdrop?.url) return backdrop.remoteUrl || backdrop.url

  const banner = images.find(img => img.coverType === "banner")
  if (banner?.remoteUrl || banner?.url) return banner.remoteUrl || banner.url

  return null
}

// Colours for !list items: done, on its way, and stuck or waiting
const LIST_DONE_COLOR = 0x32cd32 // Green
const LIST_ACTIVE_COLOR = 0xff8c00 // Orange
const LIST_WAITING_COLOR = 0xff4444 // Red

// Determine the colour of a !list item. Live status wins when it's known, otherwise the stored snapshot is used.
const getListItemStatusColor = (
  item: Movie | Series,
  contentType: "movie" | "series",
  status?: PoolItemStatus,
): number => {
  if (status) return status.downloaded ? LIST_DONE_COLOR : status.active ? LIST_ACTIVE_COLOR : LIST_WAITING_COLOR

  if (contentType === "movie") return (item as Movie).hasFile ? LIST_DONE_COLOR : LIST_WAITING_COLOR

  // Series: green if complete, orange if partial, red if nothing downloaded yet
  const downloadedPercent = (item as Series).statistics?.percentOfEpisodes || 0
  if (downloadedPercent >= 100) return LIST_DONE_COLOR
  return downloadedPercent > 0 ? LIST_ACTIVE_COLOR : LIST_WAITING_COLOR
}

// Create embed for movie/series pool item. With a live status, films that aren't downloaded show what's
// happening instead of a bare "No", e.g. "Downloading 45%, 20m left" or "Queued (#3 in line)".
export const createPoolItemEmbed = (
  item: Movie | Series,
  index: number,
  contentType: "movie" | "series",
  status?: PoolItemStatus,
): EmbedBuilder => {
  const embed = new EmbedBuilder()
    .setColor(getListItemStatusColor(item, contentType, status))
    .setTitle(`${index + 1}. ${item.title} (${item.year})`)

  let description = ""

  if (contentType === "movie") {
    const movie = item as Movie
    // Format runtime from minutes to hours and minutes
    const runtimeStr = formatRuntime(movie.runtime)
    const downloaded = status ? status.downloaded : movie.hasFile
    const downloadLine = downloaded
      ? "**Downloaded:** Yes"
      : `**Status:** ${status?.text || "Not downloaded"}`

    // Get Rotten Tomatoes rating from ratings object
    const rtScore = movie.ratings?.rottenTomatoes?.value
      ? `${movie.ratings.rottenTomatoes.value}%`
      : "N/A"

    description = `**Runtime:** ${runtimeStr}\n${downloadLine}\n🍅︎ **${rtScore}**`
  } else {
    const series = item as Series
    // Series info
    const seasons = series.seasons ? series.seasons.length : 0
    const downloadedPercent = series.statistics?.percentOfEpisodes || 0
    // Format monitor status for user-friendly display
    const rawMonitorStatus = series.monitorNewItems || "all"
    const monitorDisplay =
      rawMonitorStatus === "all"
        ? "All Seasons"
        : rawMonitorStatus.charAt(0).toUpperCase() + rawMonitorStatus.slice(1)
    const statusLine = status?.text ? `\n**Status:** ${status.text}` : ""
    description = `**Seasons:** ${seasons}\n**Monitored:** ${monitorDisplay}\n**Downloaded:** ${downloadedPercent.toFixed(0)}%${statusLine}`
  }

  embed.setDescription(description)
  
  const posterUrl = getPosterImageUrl(item.images)
  if (posterUrl) {
    embed.setThumbnail(posterUrl)
  }
  
  return embed
}

// Maximum number of suggestions shown when a user's command is missing a year
const MAX_SUGGESTIONS = 5

// Accent colour for suggestion embeds. Distinct from the download status colours used by !list
const SUGGESTION_COLOR = 0x5865f2

// Create an embed for a suggested movie/series offered when a command is missing a year
export const createSuggestionEmbed = (
  item: Movie | Series,
  index: number,
  contentType: "movie" | "series",
  command: string,
): EmbedBuilder => {
  const details: string[] = []

  if (contentType === "movie") {
    const rtScore = (item as Movie).ratings?.rottenTomatoes?.value
    details.push(`**Runtime:** ${formatRuntime(item.runtime)}`, `🍅︎ **${rtScore ? `${rtScore}%` : "N/A"}**`)
  } else {
    const series = item as Series
    details.push(`**Seasons:** ${series.statistics?.seasonCount ?? series.seasons?.length ?? 0}`)
    if (series.network) details.push(`**Network:** ${series.network}`)
  }

  // Starr app lookups only include an id when the content is already in the library
  if (item.id) details.push("📚 In library")

  const description = [
    truncateText(item.overview, 150),
    details.join(" ∙ "),
    `\`${command} ${item.title} ${item.year}\``,
  ]
    .filter(Boolean)
    .join("\n\n")

  const embed = new EmbedBuilder()
    .setColor(SUGGESTION_COLOR)
    .setTitle(`${index + 1}. ${item.title} (${item.year})`)
    .setDescription(description)

  const posterUrl = getPosterImageUrl(item.images)
  if (posterUrl) embed.setThumbnail(posterUrl)

  return embed
}

// Send suggestions as rich embeds with poster images.
// Returns false if the channel can't send embeds so the caller can fall back to plain text.
export const sendSuggestionEmbeds = async (
  message: Message,
  header: string,
  items: (Movie | Series)[],
  contentType: "movie" | "series",
): Promise<boolean> => {
  if (!("send" in message.channel) || typeof message.channel.send !== "function") return false

  // Suggest using the same command the user typed, e.g. !d, !wait or !stay
  const command = message.content.trim().split(/\s+/)[0].toLowerCase()

  const embeds = items
    .slice(0, MAX_SUGGESTIONS)
    .map((item, i) => createSuggestionEmbed(item, i, contentType, command))

  try {
    await message.channel.send({ content: header, embeds })
    return true
  } catch (err) {
    logger.error(`sendSuggestionEmbeds: Failed to send suggestions: ${err}`)
    return false
  }
}

// Create embed for webhook notifications
export const createWebhookEmbed = (
  webhookMatch: WebHookWaitingType,
  message: string,
  expired?: boolean
): EmbedBuilder => {
  const { content, waitForStatus } = webhookMatch

  // Determine embed color based on status for clear visual feedback
  let color: number
  if (expired || waitForStatus === "Expired") {
    color = 0x95a5a6 // Gray for expired/not found
  } else if (waitForStatus === "Grab") {
    color = 0xff8c00 // Orange for downloading
  } else if (waitForStatus === "Import") {
    color = 0x32cd32 // Green for ready
  } else if (waitForStatus === "Upgrade") {
    color = 0x4169e1 // Blue for better quality
  } else {
    color = 0x95a5a6 // Gray for unknown status
  }

  // Format event status for display with user-friendly terms
  const statusText = expired ? "Not Found" :
                    waitForStatus === "Grab" ? "Downloading" :
                    waitForStatus === "Import" ? "Ready" :
                    waitForStatus === "Upgrade" ? "Better Quality" :
                    waitForStatus === "Expired" ? "Not Found" : waitForStatus

  // The timestamp shows when this status was reached. A Downloading embed edited to Ready keeps
  // its original post time, so without it the Ready looks like it arrived at request time.
  const embed = new EmbedBuilder()
    .setColor(color)
    .setTimestamp()
    .setDescription(`**${statusText}**\n\n**${content.title}${
      'year' in content ? ` (${content.year})` :
      'firstAired' in content && content.firstAired ? ` (${new Date(content.firstAired as string).getFullYear()})` : ''
    }**\n${message}`)

  // Add poster image as thumbnail (small, top right)
  if ('images' in content && content.images) {
    const posterUrl = getPosterImageUrl(content.images)
    if (posterUrl) {
      embed.setThumbnail(posterUrl)
    }

    // Add backdrop/fanart as large bottom image
    const backdropUrl = getBackdropImageUrl(content.images)
    if (backdropUrl) {
      embed.setImage(backdropUrl)
    }
  }

  // Add detailed metadata fields. Short facts sit side by side, longer ones get a full row.
  // Quality and size only appear when the file details are known, never as placeholders.
  const fields: { name: string; value: string; inline: boolean }[] = []
  const addField = (name: string, value: string | number | undefined, inline: boolean) => {
    if (value !== undefined && value !== "") fields.push({ name, value: String(value), inline })
  }

  if (isMovie(content)) {
    const runtimeMins = content.runtime || 0
    const hours = Math.floor(runtimeMins / 60)
    const minutes = runtimeMins % 60
    const runtimeStr = hours > 0
      ? `${hours}h${minutes > 0 ? ` ${minutes}m` : ''}`
      : `${minutes}m`

    addField("Quality", content.movieFile?.quality?.quality?.name, true)
    addField("Runtime", runtimeStr, true)
    addField("Size", content.movieFile?.size ? formatBytes(content.movieFile.size) : undefined, true)

    if (content.overview) {
      addField("Synopsis", content.overview.length > 400 ? content.overview.substring(0, 400) + '...' : content.overview, false)
    }

    // Ratings
    const ratings = content.ratings
    const ratingsText = [
      ratings?.tmdb?.value ? `TMDb: ${ratings.tmdb.value.toFixed(1)}` : "",
      ratings?.imdb?.value ? `IMDb: ${ratings.imdb.value.toFixed(1)}/10` : "",
      ratings?.rottenTomatoes?.value ? `🍅 ${ratings.rottenTomatoes.value}%` : "",
    ].filter(Boolean).join(' ∙ ')
    addField("Ratings", ratingsText, false)

  } else if (isSeries(content)) {
    const seasons = content.seasons ? content.seasons.length : 0

    addField("Seasons", seasons, true)
    addField("Episodes", content.statistics?.totalEpisodeCount || "Unknown", true)
    addField("Size", content.statistics?.sizeOnDisk ? formatBytes(content.statistics.sizeOnDisk) : undefined, true)

    if (content.overview) {
      addField("Synopsis", content.overview.length > 400 ? content.overview.substring(0, 400) + '...' : content.overview, false)
    }

    // Ratings - Series use a different rating structure
    if (content.ratings && content.ratings.value) {
      addField("Ratings", `IMDb: ${content.ratings.value.toFixed(1)}/10`, false)
    }
  }

  if (fields.length) embed.addFields(fields)

  return embed
}

// Check if a series matches another series by various IDs
export const seriesMatches = (series1: Series, series2: Series): boolean => {
  return (
    series1.tvdbId === series2.tvdbId ||
    (!!series1.tmdbId && series1.tmdbId === series2.tmdbId) ||
    (!!series1.imdbId && series1.imdbId === series2.imdbId)
  )
}

// Normalize a string for fuzzy comparison (used by !remove command)
export const normalizeForComparison = (str: string): string => {
  return str
    .toLowerCase()
    .trim()
    .replace(/&/g, "and")
    .replace(/[''`]/g, "")
    .replace(/[^\w\s]/g, "")
    .replace(/\s+/g, " ")
}

// Check which users have a series in their pool
export const checkUserExclusivity = (
  seriesInDB: Series,
  settings: settingsDocType,
): { isExclusive: boolean; usersWithSeries: string[] } => {
  const usersWithSeries: string[] = []

  for (const u of settings.general_bot.users) {
    const hasSeries = u.pool.series.some((s) => seriesMatches(s, seriesInDB))
    if (hasSeries) {
      usersWithSeries.push(u.name)
    }
  }

  return {
    isExclusive: usersWithSeries.length === 1,
    usersWithSeries,
  }
}

// Check if a series is in Sonarr import lists
export const checkSeriesInImportList = (seriesInDB: Series, data: dataDocType): boolean => {
  const sonarrImportList = data.importLists.find((il) => il.name === "Sonarr")
  const importListItems = sonarrImportList?.listItems || []

  return importListItems.some(
    (item) =>
      item.id === seriesInDB.tmdbId ||
      item.imdb_id === seriesInDB.imdbId ||
      item.tvdbid === seriesInDB.tvdbId,
  )
}
