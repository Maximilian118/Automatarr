import moment from "moment"
import BotMemory, {
  BotMemoryPreferences,
  BotMemoryType,
  initBotMemoryPreferences,
} from "../../../models/botMemory"
import RequestLog from "../../../models/requestLog"
import logger from "../../../logger"

// Limits that keep stored memories small and cheap to send to the model
export const MAX_NOTES = 20
export const MAX_NOTE_LENGTH = 200

// Minimal identity needed to look up or create a memory document
export type DiscordIdentity = {
  id: string // Discord snowflake ID
  username: string // Current Discord username
}

// Get the memory document for a Discord user, creating an empty one if needed
export const getMemory = async (identity: DiscordIdentity): Promise<BotMemoryType> => {
  const memory = await BotMemory.findOneAndUpdate(
    { discord_id: identity.id },
    {
      $set: { username: identity.username },
      $setOnInsert: {
        discord_id: identity.id,
        notes: [],
        preferences: initBotMemoryPreferences(),
        created_at: moment().format(),
      },
    },
    { upsert: true, new: true },
  )

  return memory.toObject()
}

// Get the memory document for a Discord user without creating one
export const findMemory = async (discordId: string): Promise<BotMemoryType | null> => {
  const memory = await BotMemory.findOne({ discord_id: discordId })
  return memory ? memory.toObject() : null
}

// Read a user's preferences, falling back to defaults for users the AI hasn't met
export const getPreferences = async (discordId: string): Promise<BotMemoryPreferences> => {
  const memory = await findMemory(discordId)
  return memory?.preferences ?? initBotMemoryPreferences()
}

// Record that a user has just interacted with Automatarr.
// Returns when they were last active before now, or null if never or unknown.
export const touchActivity = async (identity: DiscordIdentity): Promise<string | null> => {
  try {
    const memory = await getMemory(identity)
    await BotMemory.updateOne(
      { discord_id: identity.id },
      { $set: { last_active_at: moment().format() } },
    )
    return memory.last_active_at
  } catch (err) {
    logger.error(`AI Bot | Failed to record activity for ${identity.username}: ${err}`)
    return null
  }
}

// Remember a new fact about a user. Returns a short status for the model.
export const rememberNote = async (identity: DiscordIdentity, text: string): Promise<string> => {
  const memory = await getMemory(identity)

  if (!memory.preferences.learning) {
    return "Not saved. This user has asked you not to learn about them."
  }

  const note = text.trim().slice(0, MAX_NOTE_LENGTH)
  if (!note) return "Not saved. The note was empty."

  // Keep the newest notes when the cap is reached
  const notes = [...memory.notes, { text: note, created_at: moment().format() }].slice(-MAX_NOTES)

  await BotMemory.updateOne(
    { discord_id: identity.id },
    { $set: { notes, updated_at: moment().format() } },
  )

  return "Saved."
}

// Merge preference changes into a user's stored preferences
export const updatePreferences = async (
  identity: DiscordIdentity,
  changes: Partial<BotMemoryPreferences>,
): Promise<BotMemoryPreferences> => {
  const memory = await getMemory(identity)
  const preferences = { ...memory.preferences, ...changes }

  await BotMemory.updateOne(
    { discord_id: identity.id },
    { $set: { preferences, updated_at: moment().format() } },
  )

  return preferences
}

// Wipe everything Automatarr has learnt about a user while keeping their preferences
export const forgetUser = async (discordId: string): Promise<void> => {
  await BotMemory.updateOne(
    { discord_id: discordId },
    { $set: { notes: [], updated_at: moment().format() } },
  )
  await RequestLog.deleteMany({ discord_id: discordId })
}

// Stamp a date field on a user's memory document
export const stampMemory = async (
  discordId: string,
  field: "last_recommended_at" | "last_fallback_notice_at",
): Promise<void> => {
  await BotMemory.updateOne({ discord_id: discordId }, { $set: { [field]: moment().format() } })
}

// Describe preferences in plain English for the model
export const describePreferences = (prefs: BotMemoryPreferences): string =>
  [
    prefs.private ? "PRIVATE (never mention their personal info in shared channels)" : "not private",
    prefs.learning ? "learning allowed" : "do NOT remember new things about them",
    prefs.recommendations ? "recommendations on" : "recommendations off",
  ].join(", ")
