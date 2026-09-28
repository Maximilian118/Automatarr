import { Message } from "discord.js"
import { settingsDocType } from "../../../../models/settings"
import { BotMemoryPreferences } from "../../../../models/botMemory"
import { DiscordIdentity } from "../aiMemory"

// Everything a tool needs to act safely on behalf of the speaker.
// Identity and permissions come from Discord, never from anything the model says.
export type ToolContext = {
  message: Message // The real message that triggered this engagement
  settings: settingsDocType
  identity: DiscordIdentity // The speaker
  isAdmin: boolean // Whether the speaker is an Automatarr admin
  isDirectMessage: boolean // Whether this conversation is happening in a DM
  preferences: BotMemoryPreferences // The speaker's privacy preferences
  actionsTaken: number // Content changing actions run so far this engagement
  postedByAction: boolean // Whether an action tool already posted a reply to the channel
  silent: boolean // Set when the model chooses to stay silent
}

// Raw tool input from the model. Always validated before use.
export type ToolInput = Record<string, unknown>

// A tool implementation returns a short plain text result for the model
export type ToolHandler = (ctx: ToolContext, input: ToolInput) => Promise<string>

// Read a trimmed string from tool input, stripping anything that could smuggle in another command
export const inputString = (input: ToolInput, key: string, maxLength: number = 100): string => {
  const value = input[key]
  if (typeof value !== "string" && typeof value !== "number") return ""

  return String(value)
    .replace(/[\r\n!<>@#`]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength)
}

// Read an optional boolean from tool input
export const inputBoolean = (input: ToolInput, key: string): boolean | undefined =>
  typeof input[key] === "boolean" ? (input[key] as boolean) : undefined

// Read an optional 4 digit year from tool input
export const inputYear = (input: ToolInput, key: string = "year"): number | undefined => {
  const year = Number(input[key])
  return Number.isInteger(year) && year > 1800 && year < 3000 ? year : undefined
}
