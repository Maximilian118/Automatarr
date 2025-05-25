import { Client, Guild, GuildBasedChannel, GuildMember, Message } from "discord.js"
import { DiscordBotType, settingsDocType } from "../../models/settings"
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

// Validate the array data for the caseInit message
export const validateInitCommand = async (msgArr: string[], message: Message): Promise<string> => {
  const validCommands = ["!initialize", "!initialise", "!init"]

  if (msgArr.length !== 3) {
    return "The !init command must contain exactly three parts: `!init <discord_username> <display_name>`."
  }

  const [command, discordUsername, displayName] = msgArr

  if (!validCommands.includes(command)) {
    return `Invalid command \`${command}\`. Use one of these: ${validCommands.join(", ")}.`
  }

  // Validate Discord username by checking actual members in the guild
  const matchedUser = message.guild?.members.cache.find(
    (member) =>
      member.user.username.toLowerCase() === discordUsername.toLowerCase() ||
      member.user.tag.toLowerCase() === discordUsername.toLowerCase(),
  )

  if (!matchedUser) {
    return `The user \`${discordUsername}\` does not exist in this server.`
  }

  const displayNameRegex = /^[a-zA-Z]{1,20}$/
  if (!displayNameRegex.test(displayName)) {
    return `\`${displayName}\` is invalid. The display name must contain only letters and be no more than 20 characters long.`
  }

  return ""
}

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
