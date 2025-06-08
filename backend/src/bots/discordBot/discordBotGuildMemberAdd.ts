import { Client, GuildMember } from "discord.js"
import Settings, { settingsDocType } from "../../models/settings"
import { discordReply, findChannelByName, noDBPull } from "./discordBotUtility"

export const guildMemberAddListener = (client: Client) => {
  client.on("guildMemberAdd", async (member: GuildMember) => {
    try {
      const settings = (await Settings.findOne()) as settingsDocType
      if (!settings) return noDBPull()

      const welcome_message = settings.general_bot.welcome_message
      const welcome_channel_name = settings.discord_bot.welcome_channel_name

      const { textBasedChannel, error } = findChannelByName(welcome_channel_name)
      if (error) return discordReply(error, "error")

      if (!textBasedChannel) {
        return discordReply(
          `guildMemberAddListener: No Channel found for ${welcome_channel_name}`,
          "error",
        )
      }

      textBasedChannel.send(
        welcome_message
          ? welcome_message
          : `🎉 Welcome to the Automatarr Discord server, ${member.user.username}!`,
      )
    } catch (err) {
      console.error("Failed to send welcome message:", err)
    }
  })
}
