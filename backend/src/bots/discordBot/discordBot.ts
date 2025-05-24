import { Client, Events, GatewayIntentBits } from "discord.js"
import { settingsDocType } from "../../models/settings"
import logger from "../../logger"
import { getServerandChannels, initDiscordBot } from "./discordBotUtility"
import { messageListeners } from "./disocrdBotListeners"

let client: Client | null = null
// Export function so discord client can be used in other documents
export const getDiscordClient = () => client

export const discordBot = async (settings: settingsDocType): Promise<settingsDocType> => {
  // If user has marked the bot as inactive, don't do anything. If logged in, log out.
  if (!settings.discord_bot.active) {
    if (client) {
      logger.warn(`Discord Bot | Logging out${client.user ? ` from ${client.user.tag}` : "."}`)
      await client.destroy()
      client = null
    } else {
      logger.info("Discord Bot | Inactive.")
    }

    settings.discord_bot.ready = false
    return settings
  }

  // Regardless of active state, if there's no token init everything and start from scratch.
  if (!settings.discord_bot.token) {
    logger.error("Discord Bot | No Token!")
    settings.discord_bot = initDiscordBot(settings.discord_bot)
    return settings
  }

  // If no server is selected, init channel list.
  if (!settings.discord_bot.server_name && settings.discord_bot.channel_list.length > 0) {
    logger.warn("Discord Bot | No Server selected. Channels removed.")
    settings.discord_bot.channel_list = []
    return settings
  }

  // If already initialized, just get latest server and channel data.
  if (client) {
    logger.info("Discord Bot | Already initialized.")
    settings.discord_bot.ready = true

    messageListeners(client, settings.toObject())

    return getServerandChannels(client, settings)
  }

  client = new Client({
    intents: [
      GatewayIntentBits.Guilds, // Required to fetch Servers
      GatewayIntentBits.GuildMembers, // Required to fetch Members
      GatewayIntentBits.GuildMessages, // Required to receive messages sent in guild text channels
      GatewayIntentBits.MessageContent, // Required to read message content
    ],
  })

  try {
    // Attempt to login, if success set ready and collect data.
    const readyPromise = new Promise<void>((resolve) => {
      client!.once(Events.ClientReady, (readyClient) => {
        logger.success(`Discord Bot | Ready! Logged in as ${readyClient.user.tag}`)
        resolve()
      })
    })

    await client.login(settings.discord_bot.token)
    await readyPromise

    messageListeners(client, settings.toObject())

    settings.discord_bot.ready = true
    return getServerandChannels(client, settings)
  } catch (err) {
    logger.error("Discord Bot | Login failed!", err)
    settings.discord_bot.ready = false
    client = null
    return settings
  }
}
