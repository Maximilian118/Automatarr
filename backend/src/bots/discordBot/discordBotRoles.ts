import { GuildMember, Message } from "discord.js"
import { discordReply, sendDiscordMessage } from "./discordBotUtility"
import { UserType } from "../../models/settings"

const OWNER_ROLE_NAME = "Owner"

export const updateDiscordOwnerRole = async (
  message: Message,
  guildMember: GuildMember,
): Promise<string> => {
  const username = guildMember.user.username

  const guild = message.guild
  if (!guild) return discordReply("Message not associated with a guild.", "error")

  const member =
    guild.members.cache.find((m) => m.user.username === username) ||
    (await guild.members
      .fetch()
      .then((members) => members.find((m) => m.user.username === username)))

  if (!member) {
    return `Could not find Discord member for username <@${guildMember.id}> in this server.`
  }

  const role = guild.roles.cache.find((r) => r.name === OWNER_ROLE_NAME)
  if (!role) {
    return discordReply(
      `I can't find the role "${OWNER_ROLE_NAME}". Please create it and ensure it has admin permissions.`,
      "error",
    )
  }

  try {
    // Remove "Owner" from everyone else
    for (const m of guild.members.cache.values()) {
      if (m.roles.cache.has(role.id) && m.id !== member.id) {
        await m.roles.remove(role)
      }
    }

    // Ensure this user has the Owner role
    if (!member.roles.cache.has(role.id)) {
      await member.roles.add(role)
    }
  } catch (err) {
    console.error(err)
    return discordReply(
      `Failed to assign the "${OWNER_ROLE_NAME}" role to <@${guildMember.id}>. Check bot permissions and role hierarchy.`,
      "error",
    )
  }

  return ""
}

const ADMIN_ROLE_NAME = "Admin"

export const updateDiscordAdminRole = async (
  message: Message,
  guildMember: GuildMember,
  user: UserType,
  shouldAdd: boolean,
): Promise<string> => {
  const username = guildMember.user.username

  const guild = message.guild
  if (!guild) return discordReply("Message not associated with a guild.", "error")

  const member =
    guild.members.cache.find((m) => m.user.username === username) ||
    (await guild.members
      .fetch()
      .then((members) => members.find((m) => m.user.username === username)))

  if (!member) {
    return `Could not find Discord member for username <@${guildMember.id}> in this server.`
  }

  const role = guild.roles.cache.find((r) => r.name === ADMIN_ROLE_NAME)
  if (!role) {
    return discordReply(
      `I can't find the role "${ADMIN_ROLE_NAME}". Please create it and ensure it has the correct permissions.`,
      "error",
    )
  }

  // If the user is not an admin in the database but is in discord, simply send a kind message
  if (shouldAdd && !user.admin && member.roles.cache.has(role.id)) {
    await sendDiscordMessage(
      message,
      `Strange... ${user.name} is not an admin but is already one in Discord. Let's fix that up.`,
    )
    return ""
  }

  try {
    if (shouldAdd) {
      await member.roles.add(role)
    } else {
      await member.roles.remove(role)
    }
  } catch (err) {
    return discordReply(
      `Failed to update roles for <@${guildMember.id}>. Check bot permissions and role hierarchy.`,
      "error",
    )
  }

  return ""
}

const SUPER_USER_ROLE_NAME = "Super User"

export const updateDiscordSuperUserRole = async (
  message: Message,
  guildMember: GuildMember,
  user: UserType,
  shouldAdd: boolean,
): Promise<string> => {
  const username = guildMember.user.username

  const guild = message.guild
  if (!guild) return discordReply("Message not associated with a guild.", "error")

  const member =
    guild.members.cache.find((m) => m.user.username === username) ||
    (await guild.members
      .fetch()
      .then((members) => members.find((m) => m.user.username === username)))

  if (!member) {
    return `Could not find Discord member for username <@${guildMember.id}> in this server.`
  }

  const role = guild.roles.cache.find((r) => r.name === SUPER_USER_ROLE_NAME)

  // If "Super User" role doesn't exist, silently skip
  if (!role) return ""

  // If the user is not a super user in the database but is in discord, simply send a kind message
  if (shouldAdd && !user.super_user && member.roles.cache.has(role.id)) {
    await sendDiscordMessage(
      message,
      `Strange... <@${guildMember.id}> is not a super user but is already one in Discord. Let's fix that up.`,
    )
    return ""
  }

  try {
    if (shouldAdd) {
      await member.roles.add(role)
    } else {
      await member.roles.remove(role)
    }
  } catch (err) {
    return discordReply(
      `Failed to update "Super User" role for <@${guildMember.id}>. Check bot permissions and role hierarchy.`,
      "error",
    )
  }

  return ""
}
