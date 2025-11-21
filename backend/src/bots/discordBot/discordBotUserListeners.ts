import { Message } from "discord.js"
import Settings, { settingsDocType } from "../../models/settings"
import { validateAdminCommand } from "./validate/validateAdminCommand"
import { validateCaseStats } from "./validate/validateCaseStats"
import { validateDeleteUserCommand } from "./validate/validateDeleteUserCommand"
import { validateInitCommand } from "./validate/validateInitCommand"
import { validateMaxCommand } from "./validate/validateMaxCommand"
import { validateOwnerCommand } from "./validate/validateOwnerCommand"
import { validateRemoveUserCommand } from "./validate/validateRemoveUserCommand"
import { validateSuperUser } from "./validate/validateSuperUser"
import {
  adminCheck,
  discordReply,
  matchedDiscordUser,
  matchedUser,
  noDBPull,
  noDBSave,
  ownerIsTarget,
} from "./discordBotUtility"
import {
  updateDiscordAdminRole,
  updateDiscordOwnerRole,
  updateDiscordSuperUserRole,
} from "./discordBotRoles"
import { saveWithRetry } from "../../shared/database"
import { capsFirstLetter } from "../../shared/utility"
import { initUser } from "../botUtility"
import { kickDiscordUser } from "./discordBotRequests"
import { checkUserMovieLimit, checkUserSeriesLimit } from "./discordBotUserLimits"
import moment from "moment"
import { randomPositiveComment, randomSadComment } from "./discordBotRandomReply"

// Give ownership to another user in the database. *** Already checking if sender is admin in switch ***
export const caseOwner = async (message: Message): Promise<string> => {
  const settings = (await Settings.findOne()) as settingsDocType
  if (!settings) return noDBPull()

  // Validate the request string: `!owner <discord_username>`
  const msgArr = message.content.slice().trim().split(/\s+/)
  const validationError = validateOwnerCommand(msgArr)
  if (validationError) return validationError

  // Extract guildMember while checking if <discord_username> exists on the server
  const guildMember = await matchedDiscordUser(message, msgArr[1])
  if (!guildMember) return `The user \`${msgArr[1]}\` does not exist in this server.`
  const username = guildMember.user.username

  // Find the user tied to the author
  const user = matchedUser(settings, message.author.username)
  if (!user) return `A Discord user by ${message.author.username} does not exist in the database.`

  // Ensure the owner is making the request
  const serverOwner = settings.general_bot.users[0]

  if (!serverOwner) {
    return "You first need to create a user in the database with `!init <discord_username> <display_name>`."
  }

  if (!serverOwner.ids.includes(message.author.username)) {
    return discordReply(
      `You are not the server owner ${user.name}. ${serverOwner.name} the supreme will not be pleased...`,
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

  const roleUpdateMsg = await updateDiscordOwnerRole(message, guildMember)
  if (roleUpdateMsg) return roleUpdateMsg

  // Save changes
  if (!(await saveWithRetry(settings, "caseOwner"))) return noDBSave()

  return discordReply(
    `I anoint thee ${newOwner.name} owner of the server supreme. Use this power wisely.`,
    "success",
    `${newOwner.name} / ${username} has been made the server owner by ${message.author.username}. Hot damn!`,
  )
}

// Add or remove an admin from a user. *** Already checking if sender is admin in switch ***
export const caseAdmin = async (message: Message): Promise<string> => {
  const settings = (await Settings.findOne()) as settingsDocType
  if (!settings) return noDBPull()

  // Validate the request string: `!admin <add/remove> <discord_username>`
  const msgArr = message.content.slice().trim().split(/\s+/)
  const validationError = validateAdminCommand(msgArr)
  if (validationError) return validationError

  // Extract params while checking if <discord_username> exists on the server
  const action = msgArr[1]
  const guildMember = await matchedDiscordUser(message, msgArr[2])
  if (!guildMember) return `The user \`${msgArr[2]}\` does not exist in this server.`
  const username = guildMember.user.username

  // Check the user exists in database
  const user = matchedUser(settings, username)
  if (!user)
    return discordReply(
      `A Discord user by <@${guildMember.id}> does not exist in the database.`,
      "warn",
    )

  // Truthy = "add", Falsy = "remove"
  const actionBoolean = action.toLowerCase().includes("add")

  // The owner has targeted themseves
  const serverOwner = settings.general_bot.users[0]
  if (serverOwner && message.author.username === username && serverOwner.ids.includes(username)) {
    return "As the server owner, you cannot add or remove admin privileges from yourself. To do so, you must first transfer ownership to another user using the !owner command. WARNING!!! Think carefully before proceeding — once you relinquish ownership, you will no longer be protected from actions by other admins."
  }

  // Check if user is already what we're trying to change it to
  if (user.admin === actionBoolean) {
    return `<@${guildMember.id}> is already ${actionBoolean ? "" : "not "}an admin silly!`
  }

  // Ensure the server owner cannot be targeted
  const ownerErr = ownerIsTarget(
    settings,
    message,
    username,
    actionBoolean ? "grant admin privileges to" : "remove admin privileges from",
  )
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

  // Update permissions for the user in discord
  const roleUpdateMsg = await updateDiscordAdminRole(message, guildMember, user, actionBoolean)
  if (roleUpdateMsg) return roleUpdateMsg

  // Save the changes to database
  if (!(await saveWithRetry(settings, "caseAdmin"))) return noDBSave()

  return discordReply(
    `<@${guildMember.id}> has been ${actionBoolean ? "promoted to" : "demoted from"} an admin. ${
      actionBoolean ? "Congratulations!" : ""
    }`,
    "success",
  )
}

// Add or remove an super_user from a user. *** Already checking if sender is admin in switch ***
export const caseSuperUser = async (message: Message): Promise<string> => {
  const settings = (await Settings.findOne()) as settingsDocType
  if (!settings) return noDBPull()

  // Validate the request string: `!superuser <add/remove> <discord_username>`
  const msgArr = message.content.slice().trim().split(/\s+/)
  const validationError = validateSuperUser(msgArr)
  if (validationError) return validationError

  // Extract params while checking if <discord_username> exists on the server
  const action = msgArr[1]
  const guildMember = await matchedDiscordUser(message, msgArr[2])
  if (!guildMember) return `The user \`${msgArr[3]}\` does not exist in this server.`
  const username = guildMember.user.username

  // The owner has targeted themseves
  const serverOwner = settings.general_bot.users[0]
  if (serverOwner && message.author.username === username && serverOwner.ids.includes(username)) {
    return "You are the server owner my liege! You have no need for such trifle."
  }

  // Ensure the server owner cannot be targeted
  const ownerErr = ownerIsTarget(settings, message, username, "give super-user permissions to")
  if (ownerErr) return ownerErr

  // Find the target user in the database
  const user = matchedUser(settings, username)
  if (!user) return `A Discord user by <@${guildMember.id}> does not exist in the database.`

  // Truthy = "add", Falsy = "remove"
  const actionBoolean = action.toLowerCase().includes("add")

  // Check if user is already what we're trying to change it to
  if (user.super_user === actionBoolean) {
    return `<@${guildMember.id}> is already ${actionBoolean ? "" : "not "}a super user silly!`
  }

  // Find the user by username and update
  settings.general_bot.users = settings.general_bot.users.map((user) => {
    if (user.ids.some((id) => id === username)) {
      return {
        ...user,
        super_user: actionBoolean,
      }
    } else {
      return user
    }
  })

  // If a role called Super User exists, update permissions for the user in discord
  const roleUpdateMsg = await updateDiscordSuperUserRole(message, guildMember, user, actionBoolean)
  if (roleUpdateMsg) return roleUpdateMsg

  // Save the changes to database
  if (!(await saveWithRetry(settings, "caseSuperUser"))) return noDBSave()

  return discordReply(
    `<@${guildMember.id}> has been ${
      actionBoolean ? "promoted to" : "demoted from"
    } a super user. ${actionBoolean ? "Congratulations!" : ""}`,
    "success",
  )
}

// Set the max_<content>_overwrite for a user
export const caseMax = async (message: Message): Promise<string> => {
  const settings = (await Settings.findOne()) as settingsDocType
  if (!settings) return noDBPull()

  // Validate the request string: `!maximum <contentType> <amount|null> <discord_username>`
  const msgArr = message.content.slice().trim().split(/\s+/)
  const validationError = validateMaxCommand(msgArr)
  if (validationError) return validationError

  const isMovie = msgArr[1].toLowerCase().includes("movie")

  // Interpret amount
  const rawAmount = msgArr[2].toLowerCase()
  const amount = rawAmount === "null" ? null : Number(rawAmount)

  // Validate numeric amount if not null
  if (amount !== null && (!Number.isInteger(amount) || amount <= 0)) {
    return "The amount must be a positive whole number (e.g., 5, 10, 42), or `null` to clear the overwrite."
  }

  // Check if <discord_username> exists on the server
  const guildMember = await matchedDiscordUser(message, msgArr[3])
  if (!guildMember) return `The user \`${msgArr[3]}\` does not exist in this server.`
  const username = guildMember.user.username

  // Find the target user in the database
  const user = matchedUser(settings, username)
  if (!user) return `A Discord user by <@${guildMember.id}> does not exist in the database.`

  // Keep track of previous value
  const previous = isMovie ? user.max_movies_overwrite : user.max_series_overwrite

  // Update user overwrite value
  settings.general_bot.users = settings.general_bot.users.map((u) => {
    if (u._id !== user._id) return u

    return {
      ...u,
      max_movies_overwrite: isMovie ? amount : u.max_movies_overwrite,
      max_series_overwrite: isMovie ? u.max_series_overwrite : amount,
    }
  })

  // Save changes
  if (!(await saveWithRetry(settings, "caseMax"))) return noDBSave()

  // Message output
  const contentType = isMovie ? "movies" : "series"

  if (amount === null) {
    return `I've cleared the ${contentType} limit overwrite for <@${guildMember.id}>.`
  }

  const isMore = previous === null || amount > previous
  const changeDirection = isMore ? "increased" : "reduced"
  const comment = isMore
    ? randomPositiveComment(`<@${guildMember.id}>`)
    : randomSadComment(`<@${guildMember.id}>`)

  return discordReply(
    `I've ${changeDirection} the maximum ${contentType} for <@${guildMember.id}> to ${amount}. ${comment}`,
    "success",
  )
}

// Initialise a user
export const caseInit = async (message: Message): Promise<string> => {
  const settings = (await Settings.findOne()) as settingsDocType
  if (!settings) return noDBPull()

  // Validate the request string: `!init <discord_username> <display_name>`
  const msgArr = message.content.trim().split(/\s+/)
  const validationError = validateInitCommand(msgArr)
  if (validationError) return validationError

  // Extract params while checking if <discord_username> exists on the server
  const name = capsFirstLetter(msgArr[2])
  const guildMember = await matchedDiscordUser(message, msgArr[1])
  if (!guildMember) return `The user \`${msgArr[1]}\` does not exist in this server.`
  const username = guildMember.user.username

  // If users exist, check for admin privileges before continuing
  if (settings.general_bot.users.length !== 0) {
    const adminError = await adminCheck(message, settings)
    if (adminError) return adminError
  }

  return runUserInit(username, name, settings)
}

// Core user initialization logic, used by both commands and auto-init flows
export const runUserInit = async (
  username: string,
  displayName: string,
  settings?: settingsDocType,
): Promise<string> => {
  settings = settings ? settings : ((await Settings.findOne()) as settingsDocType)
  if (!settings) return noDBPull()

  const name = capsFirstLetter(displayName)

  // If no users exist in the database, create the first user with admin privileges
  if (settings.general_bot.users.length === 0) {
    const user = initUser(name, username, false, true)
    settings.general_bot.users.push(user)
    if (!(await saveWithRetry(settings, "autoInit First"))) return noDBSave()

    return discordReply(
      `Welcome to the Automatarr Discord Bot ${user.name}! Your user has been created with admin privileges and owner status. Type !help to see all of my commands!`,
      "success",
      `${user.name} has created the first user and has admin privileges!`,
    )
  }

  // Check for duplicate discord usernames
  if (matchedUser(settings, username)) {
    return discordReply(`A user with the Discord username "${username}" already exists.`, "error")
  }

  // Finally, if all checks pass, create the user
  settings.general_bot.users.push(initUser(name, username))
  if (!(await saveWithRetry(settings, "autoInit"))) return noDBSave()

  return discordReply(
    `Welcome to the Automatarr Discord Bot ${name}! You can now download up to ${settings.general_bot.max_movies} Movies and ${settings.general_bot.max_series} Series. If you ever need help use the !help command.`,
    "success",
    `A new user has been created for ${name}`,
  )
}

// Delete a user
export const caseDeleteUser = async (message: Message): Promise<string> => {
  const settings = (await Settings.findOne()) as settingsDocType
  if (!settings) return noDBPull()

  // Validate the request string: `!deleteuser <discord_username>`
  const msgArr = message.content.slice().trim().split(/\s+/)
  const validationError = validateDeleteUserCommand(msgArr)
  if (validationError) return validationError

  // Extract guildMember while checking if <discord_username> exists on the server
  const guildMember = await matchedDiscordUser(message, msgArr[1])
  if (!guildMember) return `The user \`${msgArr[1]}\` does not exist in this server.`
  const username = guildMember.user.username

  // The owner has targeted themseves
  const serverOwner = settings.general_bot.users[0]
  if (serverOwner.ids.includes(message.author.username) && serverOwner.ids.includes(username)) {
    return "You cannot delete yourself my liege!"
  }

  // Ensure the server owner cannot be deleted
  const ownerErr = ownerIsTarget(settings, message, username, "deleteuser")
  if (ownerErr) return ownerErr

  // Find the target user in the database
  const user = matchedUser(settings, username)
  if (!user) return `A Discord user by <@${guildMember.id}> does not exist in the database.`

  // Remove the target user from the users array
  settings.general_bot.users = settings.general_bot.users.filter(
    (user) => !user.ids.includes(username),
  )

  // Save the new users array to the database
  if (!(await saveWithRetry(settings, "caseDeleteUser"))) return noDBSave()

  return discordReply(`${user.name} has been deleted from the database.`, "success")
}

// Remove a user from the database and the discord server
export const caseRemoveUser = async (message: Message): Promise<string> => {
  const settings = (await Settings.findOne()) as settingsDocType
  if (!settings) return noDBPull()

  // Validate the request string: `!removeuser <discord_username>`
  const msgArr = message.content.slice().trim().split(/\s+/)
  const validationError = validateRemoveUserCommand(msgArr)
  if (validationError) return validationError

  // Extract guildMember while checking if <discord_username> exists on the server
  const guildMember = await matchedDiscordUser(message, msgArr[1])
  if (!guildMember) return `The user \`${msgArr[1]}\` does not exist in this server.`
  const username = guildMember.user.username

  // The owner has targeted themseves
  const serverOwner = settings.general_bot.users[0]
  if (serverOwner.ids.includes(username)) {
    return "You cannot remove yourself my liege!"
  }

  // Ensure the server owner cannot be deleted
  const ownerErr = ownerIsTarget(settings, message, username, "removeuser")
  if (ownerErr) return ownerErr

  // Find the target user in the database
  const user = matchedUser(settings, username)
  if (!user) return `A Discord user by <@${guildMember.id}> does not exist in the database.`

  // Remove the target user from the discord server
  const kickResult = await kickDiscordUser(message, settings, username)
  if (kickResult) return kickResult

  // Remove the target user from the users array
  settings.general_bot.users = settings.general_bot.users.filter(
    (user) => !user.ids.includes(username),
  )

  // Save the new users array to the database
  if (!(await saveWithRetry(settings, "caseRemoveUser"))) return noDBSave()

  return discordReply(
    `${user.name} has been deleted from the database and removed from the server.`,
    "success",
  )
}

// Display the stats of the author or another user
export const caseStats = async (message: Message): Promise<string> => {
  const settings = (await Settings.findOne()) as settingsDocType
  if (!settings) return noDBPull()

  // Validate the request string: `!stats <optional_discord_username>`
  const msgArr = message.content.slice().trim().split(/\s+/)
  const validationError = validateCaseStats(msgArr)
  if (validationError) return validationError

  // Extract guildMember while checking if <discord_username> exists on the server
  const targetUser = msgArr[1] ? msgArr[1] : message.author.username
  const guildMember = await matchedDiscordUser(message, targetUser)
  if (!guildMember) return `The user \`${msgArr[1]}\` does not exist in this server.`
  const username = guildMember.user.username

  // Find the target user in the database
  const user = matchedUser(settings, username)
  if (!user) return `A Discord user by <@${guildMember.id}> does not exist in the database.`

  // Check user pool limits
  const { currentMovies, currentMovieMax } = checkUserMovieLimit(user, settings)
  const { currentSeries, currentSeriesMax } = checkUserSeriesLimit(user, settings)

  // Server owner check
  const serverOwner = settings.general_bot.users[0]
  const isOnwner = serverOwner.ids.includes(username)

  return (
    `🎯 Stats for <@${guildMember.id}>\n` +
    `\n` +
    `General:\n` +
    `Owner: ${isOnwner}\n` +
    `Admin: ${user.admin}\n` +
    `Super User: ${user.super_user}\n` +
    `Joined Date: ${moment(user.created_at).format("dddd, MMMM Do YYYY [at] h:mm A")}\n` +
    `\n` +
    `Pool:\n` +
    `Movies: ${currentMovies} downloaded out of ${currentMovieMax} maximum.\n` +
    `Series: ${currentSeries} downloaded out of ${currentSeriesMax} maximum.\n` +
    `Albums: Unsupported.\n` +
    `Books: Unsupported.\n`
  )
}
