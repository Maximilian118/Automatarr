import { Client, Message } from "discord.js"

export const messageListeners = (client: Client) => {
  client.on("messageCreate", async (message: Message) => {
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

      default:
        await message.channel.send(`Unknown command: \`${command}\``)
    }
  })
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
