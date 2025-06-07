import { Client, Message } from "discord.js"
import { adminCheck, sendDiscordMessage } from "./discordBotUtility"
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
import {
  caseBlocklist,
  caseDownloadSwitch,
  caseList,
  caseRemove,
} from "./discordBotContentListeners"

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
      case "help": caseHelp(message) // Display all commands and how to use them
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
      case "stats": // Display the stats of the author or another user
        await message.channel.send((await caseStats(message)))
        break
      case "list": // List pool for a user
        await message.channel.send(await caseList(message))
        break
      case "download": // Download content
        await message.channel.send(await caseDownloadSwitch(message))
        break
      case "remove": // Remove content from users pool
        await message.channel.send(await caseRemove(message))
        break
      case "blocklist":
      case "dud": // Mark a download as unsatisfactory, blocklist it and start a new download
        await message.channel.send(await caseBlocklist(message))
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

type CommandEntry = {
  name: string
  aliases?: string[]
  category: "General" | "User Management" | "Content"
  shortDescription: string
  description?: string
  usage: string
  adminRequired: boolean | "Owner"
}

const commandRegistry: CommandEntry[] = [
  {
    name: "!ping",
    category: "General",
    shortDescription: "Check responsiveness",
    usage: "!ping",
    adminRequired: false,
  },
  {
    name: "!hello",
    category: "General",
    shortDescription: "Say Hello!",
    usage: "!hello",
    adminRequired: false,
  },
  {
    name: "!help",
    category: "General",
    shortDescription: "Provides command information",
    usage: "!help <optional !command/category>",
    adminRequired: false,
  },
  {
    name: "!owner",
    category: "User Management",
    shortDescription: "Assign the server owner",
    description: "This command is quite final, so think very carefully before using it.",
    usage: "!owner <discord_username>",
    adminRequired: "Owner",
  },
  {
    name: "!admin",
    category: "User Management",
    shortDescription: "Add or remove admin privileges",
    description: "Admins can manage users and have unlimited downloads.",
    usage: "!admin <add/remove> <discord_username>",
    adminRequired: true,
  },
  {
    name: "!superuser",
    category: "User Management",
    shortDescription: "Add or remove Super User privileges",
    description: "Super Users get double the default pool size.",
    usage: "!superuser <add/remove> <discord_username>",
    adminRequired: true,
  },
  {
    name: "!maximum",
    aliases: ["`!max`"],
    category: "User Management",
    shortDescription: "Set an overwrite for a user's pool maximum",
    description: "Overrides default and Super User limits. Use `null` for unlimited.",
    usage: "!max <contentType> <amount|null> <discord_username>",
    adminRequired: true,
  },
  {
    name: "!initialise",
    aliases: ["`!init`"],
    category: "User Management",
    shortDescription: "Initialise a new user",
    description: "Creates a new pool in the Automatarr database for the targeted user.",
    usage: "!init <discord_username> <display_name>",
    adminRequired: true,
  },
  {
    name: "!deleteuser",
    category: "User Management",
    shortDescription: "Delete a user pool",
    description: "Remove content for this user but keep them in the Discord server.",
    usage: "!deleteuser <discord_username>",
    adminRequired: true,
  },
  {
    name: "!removeuser",
    category: "User Management",
    shortDescription: "Entirely remove a user",
    description: "Remove content for this user and remove them from the Discord server.",
    usage: "!removeuser <discord_username>",
    adminRequired: true,
  },
  {
    name: "!stats",
    category: "User Management",
    shortDescription: "Display the stats of a user",
    description:
      "Display the general stats of a user. Add a Discord username to target someone else.",
    usage: "!stats <optional_discord_username>",
    adminRequired: false,
  },
  {
    name: "!list",
    category: "User Management",
    shortDescription: "List a user's pool items",
    description:
      "List content in a user's pool. ContentType = pool / movies / series. Add a Discord username to target someone else.",
    usage: "!list <contentType> <optional_discord_username>",
    adminRequired: false,
  },
  {
    name: "!download",
    category: "Content",
    shortDescription: "Download content",
    description: "Download some content and add it to your pool.",
    usage: "!download <movieTitle + Year / seriesTitle SxxEyy>",
    adminRequired: false,
  },
  {
    name: "!remove",
    category: "Content",
    shortDescription: "Remove content",
    description:
      "Remove content from your pool. The !list command is handy to help choose what you'd like to remove.",
    usage: "!remove <contentType> <index/title>",
    adminRequired: false,
  },
  {
    name: "!blocklist",
    aliases: ["`!dud`"],
    category: "Content",
    shortDescription: "Replace content",
    description: "Mark a download as problematic, delete it and replace it with a different file.",
    usage: "!blocklist <movieTitle + Year / seriesTitle SxxEyy>",
    adminRequired: false,
  },
]

const renderCommandHelp = (cmd: CommandEntry): string =>
  `\`${cmd.name}\`${cmd.aliases ? `, ${cmd.aliases.join(", ")}` : ""} - ${cmd.shortDescription}\n` +
  `Usage: \`${cmd.usage}\`\n` +
  `Admin Required: ${
    cmd.adminRequired === "Owner" ? "Owner" : cmd.adminRequired ? "Yes" : "No"
  }\n` +
  `${cmd.description ? `Description: ${cmd.description}\n` : ""}`

const categoryHeaders: Record<string, string> = {
  General: "📚   **General Commands**",
  "User Management": "🎛️   **User Management**",
  Content: "🎬   **Content Commands**",
}

const renderSection = (category: string): string => {
  const header = categoryHeaders[category] || `**${category} Commands**`
  const sectionCommands = commandRegistry.filter((cmd) => cmd.category === category)
  return `${header}\n\n` + sectionCommands.map(renderCommandHelp).join("\n")
}

const caseHelp = (message: Message): void => {
  const msgArr = message.content.trim().split(/\s+/)
  const [command, query] = msgArr

  if (command.toLowerCase() !== "!help") {
    sendDiscordMessage(message, `Invalid command \`${command}\`.`)
    return
  }

  if (!query) {
    sendDiscordMessage(message, "**🤖   All Available Commands**")
    sendDiscordMessage(message, "\u200B")
    sendDiscordMessage(message, renderSection("General"))
    sendDiscordMessage(message, "\u200B")
    sendDiscordMessage(message, renderSection("User Management"))
    sendDiscordMessage(message, "\u200B")
    sendDiscordMessage(message, renderSection("Content"))
    return
  }

  if (!query.includes("!") && query.includes("general")) {
    sendDiscordMessage(message, renderSection("General"))
    return
  }

  if (!query.includes("!") && query.includes("user")) {
    sendDiscordMessage(message, renderSection("User Management"))
    return
  }

  if (!query.includes("!") && query.includes("content")) {
    sendDiscordMessage(message, renderSection("Content"))
    return
  }

  // Try match by name or alias
  const lowerQuery = query.toLowerCase()
  const found = commandRegistry.find(
    (cmd) =>
      cmd.name.toLowerCase() === lowerQuery ||
      (cmd.aliases && cmd.aliases.map((a) => a.toLowerCase()).includes(lowerQuery)),
  )

  if (found) {
    sendDiscordMessage(message, renderCommandHelp(found))
    return
  }

  sendDiscordMessage(
    message,
    `Hmm.. I don't understand what you mean by ${query}. Try "general", "user management" or "content commands".`,
  )
}
