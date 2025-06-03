import { Client, Message } from "discord.js"
import { adminCheck } from "./discordBotUtility"
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
    // prettier-ignore
    switch (command.toLowerCase()) {
      case "ping": // Calculate round trip time
        await message.channel.send(casePing(client, message))
        break
      case "hello": // Say Hello!
        await message.channel.send(`Hello, ${message.author.username}!`)
        break
      case "owner": // Assign the server owner
        await message.channel.send((await adminCheck(message)) || (await caseOwner(message)))
        break
      case "admin": // Promote or Demote somone from Admin
        await message.channel.send((await adminCheck(message)) || (await caseAdmin(message)))
        break
      case "superuser": // Promote or Demote somone from a super user
        await message.channel.send((await adminCheck(message)) || (await caseSuperUser(message)))
        break
      case "maximum":
      case "max": // Set the max_<content>_overwrite for a user
        await message.channel.send((await adminCheck(message)) || (await caseMax(message)))
        break
      case "initialize":
      case "initialise":
      case "init": // Initialise a new user in the database *** admin gets checked in the case ***
        await message.channel.send(await caseInit(message))
        break
      case "deleteuser": // Delete a user in databse only
        await message.channel.send((await adminCheck(message)) || (await caseDeleteUser(message)))
        break
      case "removeuser": // Remove a user from the database and the discord server
        await message.channel.send((await adminCheck(message)) || (await caseRemoveUser(message)))
        break
      case "download": // Download content
        await message.channel.send((await adminCheck(message)) || (await caseDownloadSwitch(message)))
        break
      // Add a case here that allows a user the list the items in their pool
      // case "list":
      // Add a case here so a user can remove a specific bit of content from their pool
      // case "remove":
      // Add !dud where we mark a movie or series as a bad download and redownload a new one after blocklisting
      // case "dud":
      case "stats": // Display the stats of the author or another user
        await message.channel.send((await caseStats(message)))
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
