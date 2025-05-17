import { Client, Events, GatewayIntentBits } from "discord.js"
import { settingsDocType } from "../../models/settings"
import logger from "../../logger"
import { getAllChannels, getAllGuilds, getAllMembersForGuild } from "./discordBotUtility"

let client: Client | null = null

export const discordBot = async (settings: settingsDocType): Promise<settingsDocType> => {
  if (!settings.discord_bot_active) {
    if (client) {
      logger.warn(`Discord Bot | Logging out${client.user ? ` from ${client.user.tag}` : "."}`)
      await client.destroy()
      client = null
    } else {
      logger.info("Discord Bot | Inactive.")
    }

    settings.discord_bot_ready = false
    return settings
  }

  if (!settings.discord_bot_token) {
    logger.error("Discord Bot | No Token!")
    return settings
  }

  if (client) {
    logger.info("Discord Bot | Already initialized.")
    settings.discord_bot_ready = true
    return settings
  }

  client = new Client({
    intents: [
      GatewayIntentBits.Guilds, // Required to fetch Servers
      GatewayIntentBits.GuildMembers, // Required to fetch Members
    ],
  })

  try {
    const readyPromise = new Promise<void>((resolve) => {
      client!.once(Events.ClientReady, (readyClient) => {
        logger.success(`Discord Bot | Ready! Logged in as ${readyClient.user.tag}`)
        resolve()
      })
    })

    await client.login(settings.discord_bot_token)
    await readyPromise

    const guilds = await getAllGuilds(client)
    console.log(guilds.map((gui) => gui.name))

    const members = await getAllMembersForGuild(client, guilds[0].id)
    console.log(members.map((me) => me.user))

    const channels = await getAllChannels(client)
    console.log(channels.map((cha) => cha.name))

    settings.discord_bot_ready = true
    return settings
  } catch (err) {
    logger.error("Discord Bot | Login failed!", err)
    settings.discord_bot_ready = false
    client = null
    return settings
  }
}
