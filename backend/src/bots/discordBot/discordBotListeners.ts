import { Client, Message } from "discord.js"
import { adminCheck } from "./discordBotUtility"
import {
  caseAdmin,
  caseDelete,
  caseInit,
  caseOwner,
  caseRemove,
  caseSuperUser,
} from "./discordBotUserListeners"

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
      case "initialize":
      case "initialise":
      case "init": // Initialise a new user in the database
        await message.channel.send(await caseInit(message))
        break
      case "delete": // Delete a user in databse only
        await message.channel.send((await adminCheck(message)) || (await caseDelete(message)))
        break
      case "remove": // Remove a user from the database and the discord server
        await message.channel.send((await adminCheck(message)) || (await caseRemove(message)))
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
    `Channel: ${message.channel}`
  )
}
