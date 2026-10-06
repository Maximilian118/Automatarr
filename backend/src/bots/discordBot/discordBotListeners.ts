import { Client, Message } from "discord.js"
import {
  caseAdmin,
  caseDeleteUser,
  caseInit,
  caseMax,
  caseOwner,
  caseRemoveUser,
  caseStats,
  caseSuperUser,
} from "./discordBotUserListeners"
import { caseDownloadSwitch } from "./discordBotContentListeners"
import { handleDiscordCase } from "./discordBotCaseHandler"
import { caseMonitor } from "./cases/discordBotcaseMonitor"
import { caseTest } from "./cases/discordBotcaseTest"
import { caseWaitTime } from "./cases/discordBotcaseWaitTime"
import { caseBlocklist } from "./cases/discordBotcaseBlocklist"
import { caseStay } from "./cases/discordBotcaseStay"
import { caseList } from "./cases/discordBotcaseList"
import { caseRemove } from "./cases/discordBotcaseRemove"
import { caseSearch } from "./cases/discordBotcaseSearch"
import { caseHelp } from "./cases/discordBotcaseHelp"
import { handleAIMessage, noteCommandActivity, resolveInvalidCommand } from "./ai/aiHandlers"
import { noteChannelMessage } from "./ai/aiContext"
import logger from "../../logger"
import { casePrivate } from "./cases/discordBotcasePrivate"
import { casePopular, caseRecommend } from "./cases/discordBotcaseDiscover"

let messageListenerFn: ((message: Message) => Promise<void>) | null = null

export const messageListeners = async (client: Client) => {
  if (messageListenerFn) {
    client.off("messageCreate", messageListenerFn)
  }

  messageListenerFn = async (message: Message) => {
    if (message.author.bot) return
    if (!("send" in message.channel)) return

    // Anyone speaking in a channel takes the floor from others chatting with the AI there
    noteChannelMessage(message.channel.id, message.author.id)

    const prefix = "!"

    // Anything that isn't a ! command may go to the AI. The AI's gate decides, for free, whether to reply.
    if (!message.content.startsWith(prefix)) {
      await handleAIMessage(message).catch((err) => logger.error(`AI Bot | ${err}`))
      return
    }

    // ! commands only work in servers. They never touch the AI unless they're malformed.
    if (!message.guild) return

    await noteCommandActivity(message)

    const [command] = message.content.slice(prefix.length).trim().split(/\s+/)

    switch (command.toLowerCase()) {
      case "hello": // Say Hello!
        await message.channel.send(`Hello, ${message.author.username}!`)
        break
      case "ping": // Calculate round trip time
        await message.channel.send(casePing(client, message))
        break
      case "help": // Display all commands and how to use them
        await caseHelp(message)
        break
      case "owner": // Assign the server owner
        await handleDiscordCase(message, caseOwner, true)
        break
      case "admin": // Promote or Demote someone from Admin
        await handleDiscordCase(message, caseAdmin, true)
        break
      case "superuser": // Promote or Demote someone from a super user
        await handleDiscordCase(message, caseSuperUser, true)
        break
      case "maximum":
      case "max": // Set the max_<content>_overwrite for a user
        await handleDiscordCase(message, caseMax, true)
        break
      case "initialize":
      case "initialise":
      case "init": // Initialise a new user in the database *** admin gets checked in the case ***
        await handleDiscordCase(message, caseInit)
        break
      case "deleteuser": // Delete a user in the database only
        await handleDiscordCase(message, caseDeleteUser, true)
        break
      case "removeuser": // Remove a user from the database and the Discord server
        await handleDiscordCase(message, caseRemoveUser, true)
        break
      case "stats": // Display the stats of the author or another user
        await handleDiscordCase(message, caseStats)
        break
      case "list": // List pool for a user
        await handleDiscordCase(message, caseList)
        break
      case "d":
      case "download": // Download content
        await handleDiscordCase(message, caseDownloadSwitch)
        break
      case "remove": // Remove content from user's pool
        await handleDiscordCase(message, caseRemove)
        break
      case "blocklist":
      case "dud": // Mark a download as unsatisfactory, blocklist it and start a new download
        await handleDiscordCase(message, caseBlocklist)
        break
      case "waittime":
      case "time":
      case "wait": // Get the amount of time a download in queue will take
        await handleDiscordCase(message, caseWaitTime)
        break
      case "stay": // Ensure some content isn't deleted by adding it to your user pool
        await handleDiscordCase(message, caseStay)
        break
      case "monitor": // Change a series monitoring options
        await handleDiscordCase(message, caseMonitor)
        break
      case "search": // Search for content across user pools
      case "find": // Alias for search
        await handleDiscordCase(message, caseSearch)
        break
      case "private": // Hide or share the author's Plex watch history and taste in public replies
        await handleDiscordCase(message, casePrivate)
        break
      case "popular": // What's been watched most on the server this month (needs Plex)
        await handleDiscordCase(message, casePopular)
        break
      case "recommend": // Rule based picks from the server the author hasn't seen
        await handleDiscordCase(message, caseRecommend)
        break
      case "test": // Test webhook notifications
        await handleDiscordCase(message, caseTest, true)
        break
      default: // Unknown command. The AI works out what they meant if it's available.
        await handleDiscordCase(message, (m) =>
          resolveInvalidCommand(m, `Sorry. I don't know this command: \`${command}\``, true),
        )
    }
  }

  client.on("messageCreate", messageListenerFn)
}

// A basic ping res
const casePing = (client: Client, message: Message): string => {
  const rtt = Date.now() - message.createdTimestamp
  const heartbeat = Math.round(client.ws.ping)

  return (
    `🏓 Pong!\n` +
    `Round-trip time: **${rtt} ms**\n` +
    `Heartbeat: **${heartbeat} ms**\n` +
    `Channel: ${message.channel}\n` +
    `User: ${message.author.toString()}`
  )
}
