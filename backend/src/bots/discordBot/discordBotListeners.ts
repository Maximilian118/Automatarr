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

let messageListenerFn: ((message: Message) => Promise<void>) | null = null

export const messageListeners = async (client: Client) => {
  if (messageListenerFn) {
    client.off("messageCreate", messageListenerFn)
  }

  messageListenerFn = async (message: Message) => {
    if (message.author.bot || !message.guild) return
    if (!("send" in message.channel)) return

    const prefix = "!"

    if (!message.content.startsWith(prefix)) return

    const [command, ..._args] = message.content.slice(prefix.length).trim().split(/\s+/)

    switch (command.toLowerCase()) {
      case "hello": // Say Hello!
        await message.channel.send(`Hello, ${message.author.username}!`)
        break
      case "ping": // Calculate round trip time
        await message.channel.send(casePing(client, message))
        break
      case "help": // Display all commands and how to use them
        caseHelp(message)
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
      case "test": // Test webhook notifications
        await handleDiscordCase(message, caseTest)
        break
      default:
        await message.channel.send(`Sorry. I don't know this command: \`${command}\``)
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
