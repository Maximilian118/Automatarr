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

// Limits for nicknames, in either direction
const MAX_NICKNAMES = 5
const MIN_NICKNAME_LENGTH = 3
const MAX_NICKNAME_LENGTH = 24

// Words too common to wake the bot. "yo bro" in a chat with friends shouldn't summon Automatarr.
const GENERIC_BOT_NICKNAMES = new Set([
  "bot", "bro", "man", "mate", "dude", "buddy", "pal", "lad", "boss", "chief", "sir", "friend",
  "hey", "hello", "you", "guys", "everyone", "here", "there", "the", "and", "yes", "nah", "yeah",
])

// Which way a nickname goes: what Automatarr calls the user, or what the user calls Automatarr
export type NicknameTarget = "them" | "you"

// In-memory copy of every user's nicknames for the bot, so the gate can check them for free.
// Loaded once on first use and kept up to date on every write.
const botNicknameCache = new Map<string, string[]>()
let botNicknamesLoaded: Promise<void> | null = null

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
        nicknames: [],
        bot_nicknames: [],
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

// Get the memory document for whichever of a bot user's Discord usernames the AI has met
export const findMemoryByUsernames = async (usernames: string[]): Promise<BotMemoryType | null> => {
  const memory = await BotMemory.findOne({ username: { $in: usernames } })
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

// Remove the remembered fact that best matches the given text. Returns a short status for the model.
export const forgetNote = async (identity: DiscordIdentity, text: string): Promise<string> => {
  const memory = await findMemory(identity.id)
  const wanted = text.trim().toLowerCase()
  if (!memory?.notes.length || !wanted) return "Nothing to forget."

  const match =
    memory.notes.find((n) => n.text.toLowerCase() === wanted) ??
    memory.notes.find((n) => n.text.toLowerCase().includes(wanted) || wanted.includes(n.text.toLowerCase()))
  if (!match) return `No remembered fact matches "${text}". Their facts are: ${memory.notes.map((n) => n.text).join("; ")}`

  await BotMemory.updateOne(
    { discord_id: identity.id },
    { $pull: { notes: { text: match.text } }, $set: { updated_at: moment().format() } },
  )

  return `Forgot "${match.text}".`
}

// Tidy a nickname: collapse whitespace and drop anything that could ping or format in Discord
const cleanNickname = (nickname: string): string =>
  nickname.replace(/[@#<>`*_~|\r\n]/g, " ").replace(/\s+/g, " ").trim()

// Reduce a name to lowercase letters and digits so "Auto-Man!" and "automan" compare equal
export const nameKey = (name: string): string => name.toLowerCase().replace(/[^a-z0-9]/g, "")

// Check a nickname is safe to use. Bot nicknames wake the bot, so they're held to a stricter standard.
// Returns a reason it was rejected, or an empty string if it's fine.
const nicknameProblem = (nickname: string, target: NicknameTarget, memberNames: string[]): string => {
  const key = nameKey(nickname)

  if (key.length < MIN_NICKNAME_LENGTH || nickname.length > MAX_NICKNAME_LENGTH) {
    return `Nicknames must be ${MIN_NICKNAME_LENGTH} to ${MAX_NICKNAME_LENGTH} characters.`
  }

  if (target === "you") {
    if (GENERIC_BOT_NICKNAMES.has(key)) return `"${nickname}" is too common a word to answer to.`
    if (memberNames.some((name) => nameKey(name) === key)) return `"${nickname}" is someone on the server's name.`
  }

  return ""
}

// Add or remove a nickname for a user, or for Automatarr as that user calls it.
// memberNames are the server members' usernames and display names, which can't become bot nicknames.
// Returns a short status for the model.
export const setNickname = async (
  identity: DiscordIdentity,
  target: NicknameTarget,
  nickname: string,
  remove: boolean,
  memberNames: string[],
): Promise<string> => {
  const memory = await getMemory(identity)
  const field = target === "them" ? "nicknames" : "bot_nicknames"
  const who = target === "them" ? "what you call them" : "what they call you"
  const cleaned = cleanNickname(nickname)
  const existing = memory[field] ?? []
  const others = existing.filter((n) => nameKey(n) !== nameKey(cleaned))

  if (!remove && target === "them" && !memory.preferences.learning) {
    return "Not saved. This user has asked you not to learn about them."
  }

  if (!remove) {
    const problem = nicknameProblem(cleaned, target, memberNames)
    if (problem) return `Not saved. ${problem}`
    if (others.length >= MAX_NICKNAMES) return `Not saved. They already have ${MAX_NICKNAMES} for ${who}: ${others.join(", ")}.`
  } else if (others.length === existing.length) {
    return `"${cleaned}" isn't in ${who}.`
  }

  const updated = remove ? others : [...others, cleaned]

  await BotMemory.updateOne(
    { discord_id: identity.id },
    { $set: { [field]: updated, updated_at: moment().format() } },
  )

  if (target === "you") botNicknameCache.set(identity.id, updated.map(nameKey))

  return `${remove ? "Removed" : "Saved"}. ${who[0].toUpperCase()}${who.slice(1)}: ${updated.length ? updated.join(", ") : "nothing yet"}.`
}

// Remove a nickname by its position in the list, e.g. from the web app. Keeps the gate's cache in step.
export const removeNicknameAt = async (discordId: string, target: NicknameTarget, index: number): Promise<void> => {
  const memory = await findMemory(discordId)
  if (!memory) throw new Error("Memory not found.")

  const field = target === "them" ? "nicknames" : "bot_nicknames"
  const updated = (memory[field] ?? []).filter((_, i) => i !== index)

  await BotMemory.updateOne({ discord_id: discordId }, { $set: { [field]: updated, updated_at: moment().format() } })
  if (target === "you") botNicknameCache.set(discordId, updated.map(nameKey))
}

// Load every user's bot nicknames into the cache. Only runs once.
const loadBotNicknames = (): Promise<void> => {
  if (!botNicknamesLoaded) {
    botNicknamesLoaded = BotMemory.find({ "bot_nicknames.0": { $exists: true } }, { discord_id: 1, bot_nicknames: 1 })
      .then((memories) => {
        memories.forEach((m) => botNicknameCache.set(m.discord_id, m.bot_nicknames.map(nameKey)))
      })
      .catch((err) => {
        botNicknamesLoaded = null
        logger.error(`AI Bot | Failed to load bot nicknames: ${err}`)
      })
  }

  return botNicknamesLoaded
}

// Get the nicknames a user calls Automatarr, as name keys. Free after the first call.
export const getBotNicknames = async (discordId: string): Promise<string[]> => {
  await loadBotNicknames()
  return botNicknameCache.get(discordId) ?? []
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
    { $set: { notes: [], nicknames: [], bot_nicknames: [], updated_at: moment().format() } },
  )
  botNicknameCache.delete(discordId)
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
