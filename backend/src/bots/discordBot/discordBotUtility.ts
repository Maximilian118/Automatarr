import { Client, Guild, GuildBasedChannel, GuildMember, Message } from "discord.js"
import { DiscordBotType, settingsDocType, UserType } from "../../models/settings"
import logger from "../../logger"

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

// Check if the server owner is the target
export const ownerIsTarget = (settings: settingsDocType, targetUsername: string): string => {
  const firstUser = settings.general_bot.users[0]

  // If !firstUser then no users exist
  if (!firstUser) {
    return "You first need to create a user in the database with `!init <discord_username> <display_name>`."
  }

  // The server owner has been targeted
  if (firstUser.ids.includes(targetUsername)) {
    return `${firstUser.name} the supreme does not have time for your shenanigans.`
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
      console.error(`Failed to fetch guild ${partialGuild.id}:`, err)
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
      console.error(`Failed to fetch channels for guild ${guild.id}:`, err)
    }
  }

  return allChannels
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
    console.error(`Error fetching members for guild ${guildId}:`, err)
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
): Promise<string | undefined> => {
  const guild = message.guild
  if (!guild) return undefined

  const mentionMatch = identifier.match(/^<@!?(\d+)>$/)

  if (mentionMatch) {
    const member = guild.members.cache.get(mentionMatch[1])
    return member?.user.username
  }

  const id = identifier.toLowerCase()

  const member = guild.members.cache.find(
    (m) => m.user.username.toLowerCase() === id || m.user.tag.toLowerCase() === id,
  )

  return member?.user.username
}

// Check if the passed Discord username exists as a user in Automatarr already
export const matchedUser = (settings: settingsDocType, identifier: string): UserType | undefined =>
  settings.general_bot.users.find((u) => u.ids.some((id) => id === identifier))

// A basic function that returns the passed string and logs it in the backend
export const discordReply = (
  msg: string,
  level: "catastrophic" | "error" | "warn" | "debug" | "info" | "success",
  customLog?: string,
): string => {
  const logMessage = `Discord Bot | ${customLog || msg}`

  if (typeof logger[level] === "function") {
    logger[level](logMessage)
  } else {
    logger.info(logMessage) // fallback in case of unexpected level
  }

  return msg
}
