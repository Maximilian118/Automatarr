import moment from "moment"
import logger from "../../logger"
import { AuthRequest, requireAuth } from "../../middleware/auth"
import BotMemory, { BotMemoryPreferences, BotMemoryType } from "../../models/botMemory"
import { AIUsageType } from "../../models/aiUsage"
import Settings, { settingsDocType, settingsType } from "../../models/settings"
import { AI_MODELS, AIModelConfig, checkAIKey } from "../../bots/discordBot/ai/aiClient"
import { getMonthlyUsage } from "../../bots/discordBot/ai/aiBudget"
import { forgetUser, removeNicknameAt } from "../../bots/discordBot/ai/aiMemory"
import { plexAccountOwner, savePlexLinks } from "../../bots/discordBot/ai/aiPlexLinks"
import { getCachedPlexAccounts, refreshPlexCache } from "../../shared/plexRequests"

// Every stored memory, most recently active first.
// Memories saved before nicknames existed get empty lists, since lean() skips schema defaults.
const allMemories = async (): Promise<BotMemoryType[]> => {
  const memories = await BotMemory.find().sort({ last_active_at: -1 }).lean()
  return memories.map((m) => ({ ...m, nicknames: m.nicknames ?? [], bot_nicknames: m.bot_nicknames ?? [] }))
}

const aiResolvers = {
  // The Claude models selectable in the web app
  getAIModels: async (_: unknown, req: AuthRequest): Promise<{ data: AIModelConfig[]; tokens: string[] }> => {
    requireAuth(req)
    return { data: AI_MODELS, tokens: req.tokens }
  },

  // Check an Anthropic API key works. Falls back to the saved key.
  checkClaude: async (
    args: { KEY?: string },
    req: AuthRequest,
  ): Promise<{ data: number; message: string; tokens: string[] }> => {
    requireAuth(req)

    const settings = (await Settings.findOne()) as settingsDocType | null
    const key = (args.KEY || settings?.ai_bot.api_key || "").trim()
    if (!key) return { data: 500, message: "No API key entered.", tokens: req.tokens }

    const { status, message } = await checkAIKey(key)
    logger.info(`AI Bot | API key check returned ${status}${message ? `: ${message}` : "."}`)

    return { data: status, message, tokens: req.tokens }
  },

  // Token and estimated spend totals for the current month
  getAIUsage: async (_: unknown, req: AuthRequest): Promise<{ data: AIUsageType; tokens: string[] }> => {
    requireAuth(req)
    return { data: await getMonthlyUsage(), tokens: req.tokens }
  },

  // Everything the AI remembers about each Discord user
  getBotMemories: async (_: unknown, req: AuthRequest): Promise<{ data: BotMemoryType[]; tokens: string[] }> => {
    requireAuth(req)
    return { data: await allMemories(), tokens: req.tokens }
  },

  // Delete a single remembered note
  deleteBotMemoryNote: async (
    args: { discord_id: string; index: number },
    req: AuthRequest,
  ): Promise<{ data: BotMemoryType[]; tokens: string[] }> => {
    requireAuth(req)

    const memory = await BotMemory.findOne({ discord_id: args.discord_id })
    if (!memory) throw new Error("Memory not found.")

    memory.notes.splice(args.index, 1)
    memory.updated_at = moment().format()
    await memory.save()
    logger.info(`AI Bot | Deleted a remembered note for ${memory.username}`)

    return { data: await allMemories(), tokens: req.tokens }
  },

  // Delete one nickname. target "them" is what the bot calls the user, "you" is what the user calls the bot.
  deleteBotNickname: async (
    args: { discord_id: string; target: string; index: number },
    req: AuthRequest,
  ): Promise<{ data: BotMemoryType[]; tokens: string[] }> => {
    requireAuth(req)
    if (args.target !== "them" && args.target !== "you") throw new Error("Unknown nickname target.")

    await removeNicknameAt(args.discord_id, args.target, args.index)
    logger.info(`AI Bot | Deleted a nickname for Discord user ${args.discord_id}`)

    return { data: await allMemories(), tokens: req.tokens }
  },

  // Forget everything about a Discord user, keeping their preferences
  forgetBotUser: async (
    args: { discord_id: string },
    req: AuthRequest,
  ): Promise<{ data: BotMemoryType[]; tokens: string[] }> => {
    requireAuth(req)

    await forgetUser(args.discord_id)
    logger.info(`AI Bot | Forgot everything about Discord user ${args.discord_id}`)

    return { data: await allMemories(), tokens: req.tokens }
  },

  // Change a Discord user's AI preferences from the web app
  updateBotMemoryPreferences: async (
    args: { discord_id: string } & Partial<BotMemoryPreferences>,
    req: AuthRequest,
  ): Promise<{ data: BotMemoryType[]; tokens: string[] }> => {
    requireAuth(req)

    const memory = await BotMemory.findOne({ discord_id: args.discord_id })
    if (!memory) throw new Error("Memory not found.")

    const keys: (keyof BotMemoryPreferences)[] = ["private", "learning", "chat", "recommendations"]
    keys.forEach((key) => {
      if (typeof args[key] === "boolean") memory.preferences[key] = args[key] as boolean
    })

    memory.updated_at = moment().format()
    await memory.save()

    return { data: await allMemories(), tokens: req.tokens }
  },

  // Every Plex account on the server and which bot user each is linked to
  getPlexAccounts: async (
    _: unknown,
    req: AuthRequest,
  ): Promise<{ data: { id: number; name: string; linked_to: string | null }[]; tokens: string[] }> => {
    requireAuth(req)

    const settings = (await Settings.findOne()) as settingsDocType
    if (!settings) throw new Error("No settings object was found.")

    // The cache is empty until the first data loop after a restart
    if (!getCachedPlexAccounts().length) await refreshPlexCache(settings._doc)

    const data = getCachedPlexAccounts().map((a) => ({
      id: a.id,
      name: a.name,
      linked_to: plexAccountOwner(settings, a.id)?.name ?? null,
    }))

    return { data, tokens: req.tokens }
  },

  // Link a bot user to a Plex account, or unlink them when no account is given
  updateUserPlexLink: async (
    args: { userId: string; plexAccountId?: number | null },
    req: AuthRequest,
  ): Promise<settingsType> => {
    requireAuth(req)

    const account =
      args.plexAccountId == null ? null : getCachedPlexAccounts().find((a) => a.id === args.plexAccountId)
    if (account === undefined) throw new Error("Plex account not found.")

    const saved = await savePlexLinks([{ userId: args.userId, account }])
    if (!saved) throw new Error("Failed to save the Plex link.")

    return { ...saved._doc, tokens: req.tokens }
  },
}

export default aiResolvers
