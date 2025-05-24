import { Client, Message } from "discord.js"
import { settingsType } from "../../models/settings"

let messageListenerFn: ((message: Message) => Promise<void>) | null = null

export const messageListeners = (client: Client, settings: settingsType) => {
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
      case "ping":
        await message.channel.send(casePing(client, message))
        break
      case "hello":
        await message.channel.send(`Hello, ${message.author.username}!`)
        break
      case "initialize":
      case "initialise":
      case "init":
        await message.channel.send(caseAuth(settings, message))
        break
      default:
        await message.channel.send(`Unknown command: \`${command}\``)
    }
  }

  client.on("messageCreate", messageListenerFn)
}

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

const caseAuth = (settings: settingsType, message: Message): string => {
  if (!message.author.username) {
    return "No username could be found."
  }

  const user = settings.general_bot.users.find((u) =>
    u.ids.some((id) => id === message.author.username),
  )

  if (user) {
    return `${user.name} already exists as a user!`
  }

  // Add creation of user object here

  return "Hmm.. something went wrong."
}
