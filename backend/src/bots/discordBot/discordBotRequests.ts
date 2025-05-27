import { Message } from "discord.js"
import { discordReply, matchedUser, ownerIsTarget } from "./discordBotUtility"
import { settingsDocType } from "../../models/settings"

// Remove a user from the discord server
export const kickDiscordUser = async (
  message: Message,
  settings: settingsDocType,
  discordUsername: string,
  reason = "Removed by bot command",
): Promise<string> => {
  const guild = message.guild
  if (!guild) return discordReply("Message not associated with a guild.", "error")

  // Try to find the user in the guild
  const member =
    guild.members.cache.find((m) => m.user.username === discordUsername) ||
    (await guild.members
      .fetch()
      .then((members) => members.find((m) => m.user.username === discordUsername))
      .catch(() => null))

  if (!member) {
    return `I could not find Discord member for username \`${discordUsername}\` in this server.`
  }

  // Find the user of the author
  const user = matchedUser(settings, message.author.username)
  if (!user) return `A Discord user by ${message.author.username} does not exist in the database.`

  // Prevent kicking bots or server owner
  if (member.user.bot) {
    return `Forgive me ${user.name}. You cannot kick a bot.`
  }

  // Ensure the server owner cannot be deleted
  const ownerErr = ownerIsTarget(settings, message, discordUsername, "kick")
  if (ownerErr) return ownerErr

  if (guild.ownerId === member.id) {
    return discordReply(
      `I will take note of this insubordination ${user.name}.`,
      "error",
      `${message.author.username} just attempted to kick the server owner...`,
    )
  }

  try {
    await member.kick(reason)
  } catch (err) {
    console.error(err)
    return discordReply(
      `Failed to remove ${discordUsername} from the server. Check bot permissions and role hierarchy.`,
      "error",
    )
  }

  return ""
}
