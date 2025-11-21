import {
  Client,
  Guild,
  GuildBasedChannel,
  GuildMember,
  GuildTextBasedChannel,
  Message,
  EmbedBuilder,
} from "discord.js"
import Settings, { DiscordBotType, settingsDocType, BotUserType } from "../../models/settings"
import logger from "../../logger"
import { QualityProfile } from "../../types/qualityProfileType"
import { dataDocType } from "../../models/data"
import { DownloadStatus, rootFolderData } from "../../types/types"
import { formatBytes } from "../../shared/utility"
import moment from "moment"
import { getDiscordClient } from "./discordBot"
import { WebHookWaitingType } from "../../models/webhook"
import { isTextBasedChannel } from "./discordBotTypeGuards"
import { isMovie, isSeries } from "../../types/typeGuards"
import { Series } from "../../types/seriesTypes"

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

// A function for type safty with message.channel.send()
export const sendDiscordMessage = async (message: Message, content: string): Promise<void> => {
  // Skip sending if content is empty or just whitespace
  if (!content || content.trim() === "") {
    return
  }
  
  if ("send" in message.channel && typeof message.channel.send === "function") {
    await message.channel.send(content)
  } else {
    logger.warn(`safeSend: Channel is not text-based. Could not send message: "${content}"`)
  }
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

  const mentionMatch = identifier.match(/^<@!?(\d+)>$/)

  if (mentionMatch) {
    const member = guild.members.cache.get(mentionMatch[1])
    return member
  }

  const id = identifier.toLowerCase()

  const member = guild.members.cache.find(
    (m) => m.user.username.toLowerCase() === id || m.user.tag.toLowerCase() === id,
  )

  return member
}

// Check if the passed Discord username exists as a user in Automatarr already
export const matchedUser = (
  settings: settingsDocType,
  identifier: string,
): BotUserType | undefined =>
  settings.general_bot.users.find((u) => u.ids.some((id) => id === identifier))

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

// Create embed for movie/series pool item
// Determine color based on download status for list command
const getListItemStatusColor = (item: any, contentType: "movie" | "series"): number => {
  if (contentType === "movie") {
    // Movies: Green if downloaded, Red if not downloaded
    return item.hasFile ? 0x32cd32 : 0xff4444  // Green : Red
  } else {
    // Series: Green if 100%, Orange if partial, Red if 0%
    const downloadedPercent = item.statistics?.percentOfEpisodes || 0
    if (downloadedPercent >= 100) {
      return 0x32cd32 // Green for complete
    } else if (downloadedPercent > 0) {
      return 0xff8c00 // Orange for partial
    } else {
      return 0xff4444 // Red for not downloaded
    }
  }
}

export const createPoolItemEmbed = (
  item: any,
  index: number,
  contentType: "movie" | "series",
  color?: number // Made optional since we'll calculate it based on status
): EmbedBuilder => {
  // Use provided color or calculate based on download status
  const embedColor = color ?? getListItemStatusColor(item, contentType)

  const embed = new EmbedBuilder()
    .setColor(embedColor)
    .setTitle(`${index + 1}. ${item.title} (${item.year})`)
  
  let description = ""
  
  if (contentType === "movie") {
    // Format runtime from minutes to hours and minutes
    const runtimeMins = item.runtime || 0
    const hours = Math.floor(runtimeMins / 60)
    const minutes = runtimeMins % 60
    const runtimeStr = hours > 0 
      ? `${hours}h${minutes > 0 ? ` ${minutes}m` : ''}`
      : `${minutes}m`
    
    const downloaded = item.hasFile ? "Yes" : "No"
    
    // Get Rotten Tomatoes rating from ratings object
    const rtScore = item.ratings?.rottenTomatoes?.value 
      ? `${item.ratings.rottenTomatoes.value}%`
      : "N/A"
    
    description = `**Runtime:** ${runtimeStr}\n**Downloaded:** ${downloaded}\n🍅︎ **${rtScore}**`
  } else {
    // Series info
    const seasons = item.seasons ? item.seasons.length : 0
    const downloadedPercent = item.statistics?.percentOfEpisodes || 0
    const totalEpisodes = item.statistics?.totalEpisodeCount || 0
    description = `**Seasons:** ${seasons}\n**Episodes:** ${totalEpisodes}\n**Downloaded:** ${downloadedPercent.toFixed(0)}%`
  }
  
  embed.setDescription(description)
  
  const posterUrl = getPosterImageUrl(item.images)
  if (posterUrl) {
    embed.setThumbnail(posterUrl)
  }
  
  return embed
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

  const embed = new EmbedBuilder()
    .setColor(color)
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

  // Add detailed metadata fields
  let fieldData = []

  if (isMovie(content)) {
    // Movie metadata
    const runtimeMins = content.runtime || 0
    const hours = Math.floor(runtimeMins / 60)
    const minutes = runtimeMins % 60
    const runtimeStr = hours > 0
      ? `${hours}h${minutes > 0 ? ` ${minutes}m` : ''}`
      : `${minutes}m`

    // First row: Quality, Runtime, Size (inline=true for 3 columns)
    fieldData.push(`**Quality**\nBluray-1080p`)
    fieldData.push(`**Runtime**\n${runtimeStr}`)
    fieldData.push(`**Size**\n12.34 GiB`)

    // Everything else in single column (inline=false) - Rating removed

    if (content.overview) {
      fieldData.push(`**Synopsis**\n${content.overview.length > 400 ? content.overview.substring(0, 400) + '...' : content.overview}`)
    }

    // Ratings
    let ratingsText = ''
    if (content.ratings) {
      const ratings = content.ratings
      if (ratings.tmdb?.value) {
        ratingsText += `TMDb: ${ratings.tmdb.value.toFixed(1)}`
      }
      if (ratings.imdb?.value) {
        ratingsText += `${ratingsText ? ' ∙ ' : ''}IMDb: ${ratings.imdb.value.toFixed(1)}/10`
      }
      if (ratings.rottenTomatoes?.value) {
        ratingsText += `${ratingsText ? ' ∙ ' : ''}🍅 ${ratings.rottenTomatoes.value}%`
      }
      if (ratingsText) {
        fieldData.push(`**Ratings**\n${ratingsText}`)
      }
    }

  } else if (isSeries(content)) {
    // Series metadata
    const seasons = content.seasons ? content.seasons.length : 0

    // First row: Quality, Seasons, Episodes (inline=true for 3 columns)
    fieldData.push(`**Quality**\nBluray-1080p`)
    fieldData.push(`**Seasons**\n${seasons}`)

    if (content.statistics?.totalEpisodeCount) {
      fieldData.push(`**Episodes**\n${content.statistics.totalEpisodeCount}`)
    } else {
      fieldData.push(`**Episodes**\nUnknown`)
    }

    // Everything else in single column (inline=false) - Rating removed

    if (content.overview) {
      fieldData.push(`**Synopsis**\n${content.overview.length > 400 ? content.overview.substring(0, 400) + '...' : content.overview}`)
    }

    // Ratings - Series use a different rating structure
    if (content.ratings && content.ratings.value) {
      fieldData.push(`**Ratings**\nIMDb: ${content.ratings.value.toFixed(1)}/10`)
    }
  }

  // Add fields with optimized layout for narrower appearance
  fieldData.forEach((field, index) => {
    const [name, value] = field.split('\n', 2)
    const isInlineField = index < 3 // First 3 fields are inline
    embed.addFields({ name: name.replace(/\*\*/g, ''), value: value, inline: isInlineField })
  })

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
