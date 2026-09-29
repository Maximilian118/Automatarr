import Anthropic from "@anthropic-ai/sdk"
import { Message } from "discord.js"
import moment from "moment"
import logger from "../../../logger"
import { settingsDocType } from "../../../models/settings"
import { matchedUser, resolveMentions, sendDiscordMessage } from "../discordBotUtility"
import { randomInCharacterDeflection } from "../discordBotRandomReply"
import { aiConfigured } from "./aiClient"
import { budgetExhausted, noteEngagement, rateLimited } from "./aiBudget"
import { getExchangeEntries, recordUserMessage } from "./aiContext"
import { describeAIError } from "./aiFallback"
import { EngageReason } from "./aiGate"
import { guardReply } from "./aiGuard"
import { DiscordIdentity, getMemory, touchActivity } from "./aiMemory"
import { COMMAND_HELP_INSTRUCTIONS } from "./aiPersona"
import { describePendingProposal } from "./aiPlexLinks"
import { createAIMessage, responseText, responseToolCalls } from "./aiRequest"
import { runTool, toolsFor } from "./aiTools"
import { buildSpeakerProfile } from "./tools/aiInfoTools"
import { checkReturningUser } from "./aiRecommendationTriggers"
import { ToolContext } from "./tools/aiToolTypes"

// Maximum request round trips per engagement, so tool loops can't run away
const MAX_ITERATIONS = 3

// What happened when the AI tried to respond
// handled = replied or deliberately stayed silent, limited = rate capped, unavailable = API or budget problem
export type AIResult = "handled" | "limited" | "unavailable"

// Details of a ! command that failed, for the AI to work out what the user meant
export type FailedCommand = {
  typed: string // The full message the user typed
  error: string // The legacy error the command produced
  usage: string // Help text for the command
}

// Explain to the model why it's seeing this message
const reasonText: Record<EngageReason | "command_help", string> = {
  direct: "They addressed you directly.",
  conversation: "They're continuing a conversation with you.",
  passing: "They mentioned your name in passing. Only reply if a quick comment genuinely fits, otherwise call stay_silent.",
  command_help: "Their ! command failed.",
}

// Escape angle brackets so user text can't close or fake the context tags
const escapeTags = (text: string): string => text.replace(/</g, "‹").replace(/>/g, "›")

// Describe where the conversation is happening
const describeWhere = (message: Message): string =>
  !message.guild
    ? "Direct message (private)"
    : `#${"name" in message.channel ? message.channel.name : "channel"} (shared channel)`

// Build the text of the message the user is replying to, if any
const replyingTo = async (message: Message): Promise<string> => {
  if (!message.reference?.messageId) return ""

  const referenced = await message.fetchReference().catch(() => null)
  if (!referenced) return ""

  const who = referenced.author.id === message.client.user?.id ? "you" : referenced.author.username
  return `<replying_to author="${escapeTags(who)}">${escapeTags(resolveMentions(referenced).slice(0, 300))}</replying_to>`
}

// The Plex pairings an admin has been shown and not yet confirmed, so "confirm" still works a few messages later
const pendingPlexLinks = (ctx: ToolContext): string => {
  const pending = ctx.isAdmin ? describePendingProposal(ctx.identity.id) : ""
  return pending ? `<pending_plex_links>\n${escapeTags(pending)}\n</pending_plex_links>` : ""
}

// Build the user turn: who's speaking, where, their recent exchange with the bot and their message
const buildUserTurn = async (
  ctx: ToolContext,
  reason: EngageReason | "command_help",
  failed?: FailedCommand,
): Promise<string> => {
  const { message } = ctx
  const transcript = getExchangeEntries(message.channel.id, message.author.id)
    .map((e) => `[${e.role === "bot" ? "you" : "them"}] ${escapeTags(e.text)}`)
    .join("\n")

  const parts = [
    "<context>",
    `Time: ${moment().format("dddd D MMM YYYY, HH:mm")}`,
    `Where: ${describeWhere(message)}`,
    `Why you're seeing this: ${reasonText[reason]}`,
    `<speaker>\n${escapeTags(await buildSpeakerProfile(ctx))}\n</speaker>`,
    transcript ? `<recent_conversation>\n${transcript}\n</recent_conversation>` : "",
    pendingPlexLinks(ctx),
    await replyingTo(message),
    "</context>",
  ]

  if (failed) {
    parts.push(
      COMMAND_HELP_INSTRUCTIONS,
      `<failed_command>${escapeTags(failed.typed)}</failed_command>`,
      `<error>${escapeTags(failed.error)}</error>`,
      `<usage>\n${escapeTags(failed.usage)}\n</usage>`,
    )
  } else {
    parts.push(`<message>${escapeTags(resolveMentions(message))}</message>`)
  }

  return parts.filter(Boolean).join("\n")
}

// Build the tool context for the speaker. Identity and permissions come from Discord only.
const buildToolContext = async (
  message: Message,
  settings: settingsDocType,
  isAdmin: boolean,
): Promise<ToolContext> => {
  const identity: DiscordIdentity = { id: message.author.id, username: message.author.username }
  const memory = await getMemory(identity)

  return {
    message,
    settings,
    identity,
    isAdmin,
    isDirectMessage: !message.guild,
    preferences: memory.preferences,
    actionsTaken: 0,
    postedByAction: false,
    silent: false,
  }
}

// Run the tool loop and return the final reply text. Empty = nothing to say.
const runConversation = async (ctx: ToolContext, userTurn: string): Promise<string> => {
  const tools = toolsFor(ctx)
  const messages: Anthropic.Beta.BetaMessageParam[] = [{ role: "user", content: userTurn }]
  let reply = ""

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    // The last round can't call tools, so work done by earlier rounds always ends in a reply
    const lastRound = i === MAX_ITERATIONS - 1
    const response = await createAIMessage(ctx.settings.ai_bot, messages, tools, lastRound ? { type: "none" } : undefined)

    if (response.stop_reason === "refusal") return randomInCharacterDeflection()

    reply = responseText(response)
    const toolCalls = responseToolCalls(response)
    if (!toolCalls.length || response.stop_reason !== "tool_use") break

    messages.push({ role: "assistant", content: response.content })

    const toolResults: Anthropic.Beta.BetaToolResultBlockParam[] = []
    for (const call of toolCalls) {
      const result = await runTool(ctx, tools, call.name, call.input)
      toolResults.push({ type: "tool_result", tool_use_id: call.id, content: result.content, is_error: result.isError })
    }

    if (ctx.silent) {
      logger.info(`AI Bot | Chose to stay silent for ${ctx.identity.username}.`)
      return ""
    }

    messages.push({ role: "user", content: toolResults })
    reply = "" // Text before a tool call is preamble. Only the final turn's text is the reply.
  }

  return reply
}

// Respond to a message with the AI. Returns what happened so callers can fall back to legacy behaviour.
export const respondWithAI = async (
  message: Message,
  settings: settingsDocType,
  reason: EngageReason | "command_help",
  failed?: FailedCommand,
): Promise<AIResult> => {
  const aiBot = settings.ai_bot
  if (!aiConfigured(aiBot)) return "unavailable"
  const isAdmin = !!matchedUser(settings, message.author.username)?.admin
  if (rateLimited(aiBot, message.author.id, isAdmin)) {
    logger.info(`AI Bot | ${message.author.username} is rate limited. Not replying.`)
    return "limited"
  }

  try {
    if (await budgetExhausted(aiBot)) {
      logger.warn("AI Bot | Monthly budget reached.")
      return "unavailable"
    }

    noteEngagement(message.author.id)

    const ctx = await buildToolContext(message, settings, isAdmin)
    const userTurn = await buildUserTurn(ctx, reason, failed)

    // Record the message after building the transcript so it isn't duplicated in the context
    if (!failed) recordUserMessage(message.channel.id, message.author.id, resolveMentions(message))
    checkReturningUser(ctx.identity, await touchActivity(ctx.identity))

    if (reason !== "passing" && "sendTyping" in message.channel) {
      await message.channel.sendTyping().catch(() => undefined)
    }

    const reply = guardReply(await runConversation(ctx, userTurn))

    if (reply) {
      await sendDiscordMessage(message, reply, { parse: [], repliedUser: false })
    } else if (!ctx.silent && !ctx.postedByAction) {
      logger.info(`AI Bot | Came back with an empty reply for ${ctx.identity.username}.`)
    }

    return "handled"
  } catch (err) {
    logger.error(`AI Bot | ${describeAIError(err)}`)
    return "unavailable"
  }
}
