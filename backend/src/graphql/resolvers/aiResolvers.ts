import moment from "moment"
import logger from "../../logger"
import { AuthRequest } from "../../middleware/auth"
import BotMemory, { BotMemoryPreferences, BotMemoryType } from "../../models/botMemory"
import { AIUsageType } from "../../models/aiUsage"
import Settings, { settingsDocType, settingsType } from "../../models/settings"
import { saveWithRetry } from "../../shared/database"
import { AI_MODELS, AIModelConfig, checkAIKey } from "../../bots/discordBot/ai/aiClient"
import { getMonthlyUsage } from "../../bots/discordBot/ai/aiBudget"
import { forgetUser } from "../../bots/discordBot/ai/aiMemory"

// Throw if the request isn't from a logged in web app user
const requireAuth = (req: AuthRequest): void => {
  if (!req.isAuth) throw new Error("Unauthorised")
}

// Every stored memory, most recently active first
const allMemories = async (): Promise<BotMemoryType[]> =>
  BotMemory.find().sort({ last_active_at: -1 }).lean()

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

  // Link a bot user to their Plex account name
  updateUserPlexUsername: async (
    args: { userId: string; plexUsername: string },
    req: AuthRequest,
  ): Promise<settingsType> => {
    requireAuth(req)

    const settings = (await Settings.findOne()) as settingsDocType
    if (!settings) throw new Error("No settings object was found.")

    const userIndex = settings.general_bot.users.findIndex((u) => u._id?.toString() === args.userId)
    if (userIndex === -1) throw new Error("User not found.")

    settings.general_bot.users[userIndex].plex_username = args.plexUsername.trim()
    settings.markModified(`general_bot.users.${userIndex}`)
    settings.updated_at = moment().format()
    await saveWithRetry(settings, "updateUserPlexUsername")

    return { ...settings._doc, tokens: req.tokens }
  },
}

export default aiResolvers
