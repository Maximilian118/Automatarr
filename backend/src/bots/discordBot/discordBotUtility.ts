import { Client, Guild, GuildBasedChannel, GuildMember, Message } from "discord.js"
import Settings, { DiscordBotType, settingsDocType, UserType } from "../../models/settings"
import logger from "../../logger"
import { QualityProfile } from "../../types/qualityProfileType"
import { dataDocType } from "../../models/data"
import { rootFolderData } from "../../types/types"
import { formatBytes } from "../../shared/utility"

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
  if ("send" in message.channel && typeof message.channel.send === "function") {
    await message.channel.send(content)
  } else {
    logger.warn(`safeSend: Channel is not text-based. Could not send message: "${content}"`)
  }
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
