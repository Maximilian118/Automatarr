import { Message } from "discord.js"
import { discordReply } from "./discordBotUtility"

const ADMIN_ROLE_NAME = "Admin"

export const updateDiscordAdminRole = async (
  message: Message,
  discordUsername: string,
  shouldAdd: boolean,
): Promise<string> => {
  const guild = message.guild
  if (!guild) return discordReply("Message not associated with a guild.", "error")

  const member =
    guild.members.cache.find((m) => m.user.username === discordUsername) ||
    (await guild.members
      .fetch()
      .then((members) => members.find((m) => m.user.username === discordUsername)))

  if (!member) {
    return `Could not find Discord member for username \`${discordUsername}\` in this server.`
  }

  const role = guild.roles.cache.find((r) => r.name === ADMIN_ROLE_NAME)
  if (!role) {
    return discordReply(
      `I can't find the role "${ADMIN_ROLE_NAME}". Please create it and ensure it has the correct permissions.`,
      "error",
    )
  }

  try {
    if (shouldAdd) {
      await member.roles.add(role)
    } else {
      await member.roles.remove(role)
    }
  } catch (err) {
    return discordReply(
      `Failed to update roles for ${discordUsername}. Check bot permissions and role hierarchy.`,
      "error",
    )
  }

  return ""
}
