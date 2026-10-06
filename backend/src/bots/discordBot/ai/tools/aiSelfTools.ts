import { BotMemoryPreferences } from "../../../../models/botMemory"
import logger from "../../../../logger"
import { matchedDiscordUser } from "../../discordBotUtility"
import {
  describePreferences,
  findMemory,
  forgetNote,
  forgetUser,
  rememberNote,
  setNickname,
  updatePreferences,
} from "../aiMemory"
import { getRequestHistory } from "../aiRequestLog"
import { ToolContext, ToolHandler, ToolInput, inputBoolean, inputString } from "./aiToolTypes"

// Pull only the preference flags the model actually set
const preferenceChanges = (input: ToolInput): Partial<BotMemoryPreferences> => {
  const changes: Partial<BotMemoryPreferences> = {}
  const keys: (keyof BotMemoryPreferences)[] = ["private", "learning", "chat", "recommendations"]

  keys.forEach((key) => {
    const value = inputBoolean(input, key)
    if (value !== undefined) changes[key] = value
  })

  return changes
}

// Remember a fact about the speaker
const remember: ToolHandler = async (ctx, input) => {
  const fact = inputString(input, "fact", 200)
  if (!fact) return "Nothing to remember."
  if (!ctx.preferences.learning) return "Not saved. The speaker asked you not to learn about them."

  return rememberNote(ctx.identity, fact)
}

// Forget one remembered fact about the speaker
const forgetFact: ToolHandler = async (ctx, input) => {
  const fact = inputString(input, "fact", 200)
  if (!fact) return "Nothing to forget."

  return forgetNote(ctx.identity, fact)
}

// Usernames and display names of everyone on the server, so nobody's name becomes a bot nickname
const serverMemberNames = (ctx: ToolContext): string[] =>
  [...(ctx.message.guild?.members.cache.values() ?? [])].flatMap((m) => [m.user.username, m.displayName])

// Add or remove a nickname for the speaker, or for Automatarr as the speaker calls it
const setNicknameTool: ToolHandler = async (ctx, input) => {
  const target = input.for === "them" || input.for === "you" ? input.for : null
  const nickname = inputString(input, "nickname", 40)
  if (!target || !nickname) return "Not saved. Say who the nickname is for (them or you) and what it is."

  const result = await setNickname(ctx.identity, target, nickname, inputBoolean(input, "remove") === true, serverMemberNames(ctx))
  logger.bot(`AI Bot | ${ctx.identity.username} | Nickname for ${target} "${nickname}": ${result}`)

  return result
}

// Change the speaker's own preferences
const setMyPreferences: ToolHandler = async (ctx, input) => {
  const changes = preferenceChanges(input)
  if (!Object.keys(changes).length) return "No preferences were changed."

  const updated = await updatePreferences(ctx.identity, changes)
  ctx.preferences = updated
  logger.bot(`AI Bot | ${ctx.identity.username} updated their preferences: ${JSON.stringify(changes)}`)

  return `Updated. Their preferences are now: ${describePreferences(updated)}.`
}

// Forget everything remembered about the speaker
const forgetMe: ToolHandler = async (ctx) => {
  await forgetUser(ctx.identity.id)
  logger.bot(`AI Bot | Forgot everything about ${ctx.identity.username}`)

  return "Done. Their remembered facts, nicknames and request history are wiped. Their preferences were kept."
}

// Privately DM the speaker everything stored about them
const sendMyDataByDM: ToolHandler = async (ctx) => {
  const memory = await findMemory(ctx.identity.id)
  const history = await getRequestHistory(ctx.identity.id, 10)

  const text = [
    "🤐 **Here's everything I remember about you:**",
    `**Preferences:** ${describePreferences(ctx.preferences)}`,
    `**What I call you:** ${memory?.nicknames?.length ? memory.nicknames.join(", ") : "just your name"}`,
    `**What you call me:** ${memory?.bot_nicknames?.length ? memory.bot_nicknames.join(", ") : "Automatarr"}`,
    `**Notes:** ${memory?.notes.length ? memory.notes.map((n) => `\n• ${n.text}`).join("") : "nothing yet"}`,
    `**Recent requests:** ${history.length ? history.map((h) => `\n• ${h.action} ${h.title} (${h.year})`).join("") : "none logged"}`,
    "",
    "Say *forget me* to wipe this, or *keep my info private* to keep it out of shared channels. Server admins can also see and delete this in the Automatarr web app.",
  ].join("\n")

  try {
    await ctx.message.author.send(text)
    return "Sent them a DM with their data."
  } catch {
    return "Couldn't DM them. Their Discord privacy settings probably block DMs from server members."
  }
}

// Choose not to reply at all
const staySilent: ToolHandler = async (ctx: ToolContext) => {
  ctx.silent = true
  return "Staying silent."
}

// Admin only. Change another member's preferences.
const setUserPreferences: ToolHandler = async (ctx, input) => {
  if (!ctx.isAdmin) return "Refused. Only admins can change other people's preferences."

  const identifier = inputString(input, "user", 50)
  const member = identifier && ctx.message.guild ? await matchedDiscordUser(ctx.message, identifier) : undefined
  if (!member) return `Couldn't find a server member called "${identifier}".`

  const changes = preferenceChanges(input)
  if (!Object.keys(changes).length) return "No preferences were changed."

  const updated = await updatePreferences({ id: member.id, username: member.user.username }, changes)
  logger.bot(`AI Bot | Admin ${ctx.identity.username} updated ${member.user.username}'s preferences: ${JSON.stringify(changes)}`)

  return `Updated ${member.user.username}. Their preferences are now: ${describePreferences(updated)}.`
}

// Handlers for every self and admin tool, keyed by tool name
export const SELF_HANDLERS: Record<string, ToolHandler> = {
  remember,
  forget_fact: forgetFact,
  set_nickname: setNicknameTool,
  set_my_preferences: setMyPreferences,
  forget_me: forgetMe,
  send_my_data_by_dm: sendMyDataByDM,
  stay_silent: staySilent,
  set_user_preferences: setUserPreferences,
}
