import { Client, Message } from "discord.js"
import { discordReply, validateInitCommand } from "./discordBotUtility"
import { initUser } from "../botUtility"
import Settings, { settingsDocType } from "../../models/settings"
import { saveWithRetry } from "../../shared/database"
import { capsFirstLetter } from "../../shared/utility"

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
      case "ping":
        await message.channel.send(casePing(client, message))
        break
      case "hello":
        await message.channel.send(`Hello, ${message.author.username}!`)
        break
      case "admin":
        await message.channel.send((await adminCheck(message)) || (await caseAdmin(message)))
        break
      case "initialize":
      case "initialise":
      case "init":
        await message.channel.send(await caseInit(message))
        break
      default:
        await message.channel.send(`Unknown command: \`${command}\``)
    }
  }

  client.on("messageCreate", messageListenerFn)
}

const noDBPull = discordReply("I couldn't connect to the database. Please try again.", "error")
const noDBSave = discordReply("I couldn't save to the databse. Please try again.", "error")

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

// Function to check if the message sender is an admin
const adminCheck = async (message: Message, passedSettings?: settingsDocType): Promise<string> => {
  const settings = passedSettings ? passedSettings : ((await Settings.findOne()) as settingsDocType)
  if (!settings) return noDBPull

  const sender = settings.general_bot.users.find((u) =>
    u.ids.some((id) => id === message.author.username),
  )

  if (!sender) {
    return discordReply(
      "You are not a registered user. Please refer to an admin.",
      "error",
      `${message.author.username} is not a user and failed admin check for command: ${message}`,
    )
  }

  if (!sender.admin) {
    return discordReply(
      `You are not an admin ${sender.name}...`,
      "error",
      `${message.author.username} failed admin check for command: ${message}`,
    )
  }

  return ""
}

// Add or remove an admin from a user
const caseAdmin = async (message: Message): Promise<string> => {
  const settings = (await Settings.findOne()) as settingsDocType
  if (!settings) return noDBPull

  if (message.content.toLowerCase().includes("add")) {
    console.log(settings)
  }

  if (message.content.toLowerCase().includes("remove")) {
    console.log(settings)
  }

  return "Hmm.. something went wrong."
}

// Initialise a user
const caseInit = async (message: Message): Promise<string> => {
  const settings = (await Settings.findOne()) as settingsDocType
  if (!settings) return noDBPull

  const msgArr = message.content.toLowerCase().slice().trim().split(/\s+/)
  const validationError = await validateInitCommand(msgArr, message)

  if (validationError) {
    return validationError
  }

  const name = capsFirstLetter(msgArr[2])
  const username = msgArr[1]

  // If no users exist, create the first user with admin
  if (settings.general_bot.users.length === 0) {
    const user = initUser(name, username, false, true)
    settings.general_bot.users.push(user)
    if (!(await saveWithRetry(settings, "caseInit First"))) return noDBSave

    return discordReply(
      `Welcome to the Automatarr Discord Bot ${user.name}! Your user has been created with admin privileges. Type !help to see all of my commands!`,
      "success",
      `${user.name} has created the first user and has admin privileges!`,
    )
  }

  // If users exist, check for admin privileges before continuing
  const adminError = await adminCheck(message, settings)

  if (adminError) {
    return adminError
  }

  // Check for duplicates
  const existingUsernames = settings.general_bot.users.flatMap((u) => u.ids)

  if (existingUsernames.some((id) => id === username)) {
    return discordReply(`A user with the Discord username "${username}" already exists.`, "error")
  }

  // Finally, if all checks pass, create the user.
  settings.general_bot.users.push(initUser(name, username))
  if (!(await saveWithRetry(settings, "caseInit"))) return noDBSave

  return discordReply(
    `Welcome to the Automatarr Discord Bot ${name}! You can now download up to ${settings.general_bot.max_movies} Movies and ${settings.general_bot.max_series} Series. If you ever need help use the !help command.`,
    "success",
    `A new user has been created for ${name}`,
  )
}
