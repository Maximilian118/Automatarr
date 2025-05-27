import { Client, Message } from "discord.js"
import { discordReply, matchedDiscordUser, matchedUser, ownerIsTarget } from "./discordBotUtility"
import { initUser } from "../botUtility"
import Settings, { settingsDocType } from "../../models/settings"
import { saveWithRetry } from "../../shared/database"
import { capsFirstLetter } from "../../shared/utility"
import {
  validateAdminCommand,
  validateDeleteCommand,
  validateInitCommand,
  validateOwnerCommand,
} from "./discordRequestValidation"

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
      case "initialize":
      case "initialise":
      case "init": // Initialise a new user in the database
        await message.channel.send(await caseInit(message))
        break
      case "delete": // Delete a user in databse only
        await message.channel.send((await adminCheck(message)) || (await caseDelete(message)))
        break
      default:
        await message.channel.send(`Sorry. I don't know this command: \`${command}\``)
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

// Give ownership to another user in the database. *** Already checking if sender is admin in switch ***
const caseOwner = async (message: Message): Promise<string> => {
  const settings = (await Settings.findOne()) as settingsDocType
  if (!settings) return noDBPull

  // Validate the request string: `!owner <discord_username>`
  const msgArr = message.content.slice().trim().split(/\s+/)
  const validationError = validateOwnerCommand(msgArr)
  if (validationError) return validationError

  // Extract username while checking if <discord_username> exists on the server
  const username = await matchedDiscordUser(message, msgArr[1])
  if (!username) return `The user \`${msgArr[1]}\` does not exist in this server.`

  // Find the user tied to the author
  const user = matchedUser(settings, message.author.username)
  if (!user) return `A Discord user by ${message.author.username} does not exist in the database.`

  // Ensure the owner is making the request
  const firstUser = settings.general_bot.users[0]

  if (!firstUser) {
    return "You first need to create a user in the database with `!init <discord_username> <display_name>`."
  }

  if (!firstUser.ids.includes(message.author.username)) {
    return discordReply(
      `You are not the server owner ${user.name}. ${firstUser.name} the supreme will not be pleased...`,
      "warn",
      `${user.name} / ${message.author.username} tried to promote ${username} to owner...`,
    )
  }

  // Find the target user in the list
  const targetIndex = settings.general_bot.users.findIndex((u) => u.ids.includes(username))

  if (targetIndex === -1) {
    return `The user \`${username}\` does not exist in the database.`
  }

  // Move the new owner to index 0
  const [newOwner] = settings.general_bot.users.splice(targetIndex, 1)
  newOwner.admin = true // Always ensure new owner is admin
  settings.general_bot.users.unshift(newOwner)

  // Save changes
  if (!(await saveWithRetry(settings, "caseOwner"))) return noDBSave

  return discordReply(
    `I anoint thee ${newOwner.name} owner of the server supreme. Use this power wisely.`,
    "success",
    `${newOwner.name} / ${username} has been made the server owner by ${message.author.username}. Hot damn!`,
  )
}

// Add or remove an admin from a user. *** Already checking if sender is admin in switch ***
const caseAdmin = async (message: Message): Promise<string> => {
  const settings = (await Settings.findOne()) as settingsDocType
  if (!settings) return noDBPull

  // Validate the request string: `!admin <add/remove> <discord_username>`
  const msgArr = message.content.slice().trim().split(/\s+/)
  const validationError = validateAdminCommand(msgArr)
  if (validationError) return validationError

  // Extract params while checking if <discord_username> exists on the server
  const action = msgArr[1]
  const username = await matchedDiscordUser(message, msgArr[2])
  if (!username) return `The user \`${msgArr[2]}\` does not exist in this server.`

  // Check the user exists in database
  const user = matchedUser(settings, username)

  if (!user) {
    return discordReply(`A Discord user by ${username} does not exist in the database.`, "error")
  }

  // Truthy = "add", Falsy = "remove"
  const actionBoolean = action.toLowerCase().includes("add")

  // Check if user is already what we're trying to change it to
  if (user.admin === actionBoolean) {
    return `${user.name} is already ${actionBoolean ? "" : "not "}an admin silly!`
  }

  // The owner has targeted themseves
  if (message.author.username === username) {
    return "As the server owner, you cannot remove admin privileges from yourself. To do so, you must first transfer ownership to another user using the !owner command. WARNING!!! Think carefully before proceeding — once you relinquish ownership, you will no longer be protected from actions by other admins."
  }

  // Ensure the server owner cannot be demoted
  const ownerErr = ownerIsTarget(settings, username)
  if (ownerErr) return ownerErr

  // Find the user by username and update
  settings.general_bot.users = settings.general_bot.users.map((user) => {
    if (user.ids.some((id) => id === username)) {
      return {
        ...user,
        admin: actionBoolean,
      }
    } else {
      return user
    }
  })

  // Save the changes to database
  if (!(await saveWithRetry(settings, "caseAdmin"))) return noDBSave

  return discordReply(
    `${user.name} has been ${actionBoolean ? "promoted to" : "demoted from"} an admin.`,
    "success",
  )
}

// Initialise a user
const caseInit = async (message: Message): Promise<string> => {
  const settings = (await Settings.findOne()) as settingsDocType
  if (!settings) return noDBPull

  // Validate the request string: `!init <discord_username> <display_name>`
  const msgArr = message.content.slice().trim().split(/\s+/)
  const validationError = validateInitCommand(msgArr)
  if (validationError) return validationError

  // Extract params while checking if <discord_username> exists on the server
  const name = capsFirstLetter(msgArr[2])
  const username = await matchedDiscordUser(message, msgArr[1])
  if (!username) return `The user \`${msgArr[1]}\` does not exist in this server.`

  // If no users exist in the database, create the first user with admin privileges
  if (settings.general_bot.users.length === 0) {
    const user = initUser(name, username, false, true)
    settings.general_bot.users.push(user)
    if (!(await saveWithRetry(settings, "caseInit First"))) return noDBSave

    return discordReply(
      `Welcome to the Automatarr Discord Bot ${user.name}! Your user has been created with admin privileges and owner status. Type !help to see all of my commands!`,
      "success",
      `${user.name} has created the first user and has admin privileges!`,
    )
  }

  // If users exist, check for admin privileges before continuing
  const adminError = await adminCheck(message, settings)
  if (adminError) return adminError

  // Check for duplicate discord usernames
  if (matchedUser(settings, username)) {
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

// Delete a user
const caseDelete = async (message: Message): Promise<string> => {
  const settings = (await Settings.findOne()) as settingsDocType
  if (!settings) return noDBPull

  // Validate the request string: `!delete <discord_username>`
  const msgArr = message.content.slice().trim().split(/\s+/)
  const validationError = validateDeleteCommand(msgArr)
  if (validationError) return validationError

  // Extract username while checking if <discord_username> exists on the server
  const username = await matchedDiscordUser(message, msgArr[1])
  if (!username) return `The user \`${msgArr[1]}\` does not exist in this server.`

  // The owner has targeted themseves
  if (message.author.username === username) {
    return "You cannot delete your own data my liege!"
  }

  // Ensure the server owner cannot be deleted
  const ownerErr = ownerIsTarget(settings, username)
  if (ownerErr) return ownerErr

  // Find the target user in the database
  const user = matchedUser(settings, username)
  if (!user) return `A Discord user by ${message.author.username} does not exist in the database.`

  // Remove the target user from the users array
  settings.general_bot.users = settings.general_bot.users.filter(
    (user) => !user.ids.includes(username),
  )

  // Save the new users array to the database
  if (!(await saveWithRetry(settings, "caseDelete"))) return noDBSave

  return `${user.name} has been deleted from the database.`
}
