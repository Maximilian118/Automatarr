import Anthropic from "@anthropic-ai/sdk"
import { Message } from "discord.js"
import moment from "moment"
import logger from "../../../logger"
import { settingsDocType } from "../../../models/settings"
import { matchedUser, resolveMentions, sendDiscordMessage } from "../discordBotUtility"
import { randomAcknowledgement, randomInCharacterDeflection } from "../discordBotRandomReply"
import { aiConfigured, getModelConfig } from "./aiClient"
import { budgetExhausted, noteEngagement, rateLimited } from "./aiBudget"
import { clearAsides, getAsides, getExchangeEntries, getUserEvents, recordAside, recordUserMessage } from "./aiContext"
import { describeAIError } from "./aiFallback"
import { EngageReason } from "./aiGate"
import { guardReply, trimToCleanEnding } from "./aiGuard"
import { DiscordIdentity, getMemory, touchActivity } from "./aiMemory"
import { COMMAND_HELP_INSTRUCTIONS } from "./aiPersona"
import { describePendingProposal } from "./aiPlexLinks"
import { createAIMessage, responseText, responseToolCalls } from "./aiRequest"
import { speakerDownloads } from "./aiDownloads"
import { ensureTitleIndex, titlesInMessage } from "./aiTitleIndex"
import { runTool, toolsFor } from "./aiTools"
import { browseViewerFor, buildSpeakerProfile, describeFoundTitles } from "./tools/aiInfoTools"
import { BrowseFilters, browseMatches, describeBrowseResult } from "../discordBotBrowse"
import { recommendationRequest } from "./aiIntent"
import { checkReturningUser } from "./aiRecommendationTriggers"
import { ToolContext } from "./tools/aiToolTypes"

// Maximum request round trips per engagement, so tool loops can't run away
const MAX_ITERATIONS = 3

// A request cut off by the token ceiling mid tool call, or before writing anything, is retried once with this much more room
const CUT_OFF_RETRY_MULTIPLIER = 2

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

// Turn the speaker's recent exchange with the bot into real alternating turns, so the model
// follows the thread the way a conversation actually went. Neighbouring lines from the same side merge.
const historyTurns = (message: Message): Anthropic.Beta.BetaMessageParam[] => {
  const turns: Anthropic.Beta.BetaMessageParam[] = []

  getExchangeEntries(message.channel.id, message.author.id).forEach((entry) => {
    const role = entry.role === "bot" ? "assistant" : "user"
    const text = escapeTags(entry.text)
    const last = turns[turns.length - 1]

    if (last?.role === role) last.content = `${last.content}\n${text}`
    else turns.push({ role, content: text })
  })

  // The conversation must open with the user. If it opens with the bot, show that an earlier bit was cut.
  if (turns[0]?.role === "assistant") turns.unshift({ role: "user", content: "[earlier messages]" })

  return turns
}

// Most server picks offered up front for a recommendation request
const MAX_SERVER_PICKS = 5

// For a message asking for a recommendation, the best titles already on the server for that genre and
// type, so the model can suggest them without a browse_library round. Unseen ones when their history
// can be used, otherwise the best rated. Returns the <server_picks> block, or "" if it isn't a request.
const serverPicks = async (ctx: ToolContext, text: string): Promise<string> => {
  const request = recommendationRequest(text)
  if (!request) return ""

  const filters: BrowseFilters = {
    type: request.type,
    genre: request.genre,
    keyword: "",
    recentDays: 0,
    minRating: 0,
    unseen: true,
    popular: false,
  }

  const { results, seenChecked } = await browseMatches(browseViewerFor(ctx), filters)
  if (!results.length) return ""

  const note = seenChecked
    ? "Downloaded on the server and unseen by them, best for their taste first."
    : "Downloaded on the server, best rated first. Their watch history can't be used here."
  const lines = results.slice(0, MAX_SERVER_PICKS).map((r) => describeBrowseResult(r, filters))

  return `<server_picks note="${note} Suggest from here or from your own knowledge.">\n${escapeTags(lines.join("\n"))}\n</server_picks>`
}

// Facts looked up in code before the model is called, so common questions need no tool round:
// library titles named in the message (or in what they said just before), and what the speaker
// has downloading right now. Both are left out when empty, so ordinary chat costs nothing extra.
const prefetchedFacts = async (ctx: ToolContext, asides: string[]): Promise<string[]> => {
  await ensureTitleIndex()

  const text = [...asides, resolveMentions(ctx.message)].join("\n")
  const named = titlesInMessage(text)
  const botUser = matchedUser(ctx.settings, ctx.identity.username)
  const [matches, downloads, picks] = await Promise.all([
    describeFoundTitles(ctx, named, false),
    speakerDownloads(ctx.settings, ctx.identity.id, botUser),
    serverPicks(ctx, text),
  ])

  return [
    matches.length
      ? `<library_matches note="Library titles named in their messages, looked up for you. Rely on these facts, and only call find_title if they don't answer it.">\n${escapeTags(matches.join("\n"))}\n</library_matches>`
      : "",
    downloads.length
      ? `<your_downloads note="What the speaker has downloading right now.">\n${escapeTags(downloads.join("\n"))}\n</your_downloads>`
      : "",
    picks,
  ]
}

// Build the user turn: who's speaking, where, what happened recently and their message
const buildUserTurn = async (
  ctx: ToolContext,
  reason: EngageReason | "command_help",
  failed?: FailedCommand,
): Promise<string> => {
  const { message } = ctx
  const events = getUserEvents(message.author.id)
    .map((e) => `[${moment(e.at).fromNow()}] ${escapeTags(e.text)}`)
    .join("\n")
  const asideTexts = getAsides(message.channel.id, message.author.id)
  const asides = asideTexts.map((text) => `[them] ${escapeTags(text)}`).join("\n")

  const parts = [
    "<context>",
    `Time: ${moment().format("dddd D MMM YYYY, HH:mm")}`,
    `Where: ${describeWhere(message)}`,
    `Why you're seeing this: ${reasonText[reason]}`,
    `<speaker>\n${escapeTags(await buildSpeakerProfile(ctx))}\n</speaker>`,
    events ? `<recent_events note="Things that happened for them outside this chat, newest last.">\n${events}\n</recent_events>` : "",
    asides ? `<said_just_before note="Their own messages from the last few minutes that you didn't reply to. Context only, they may not have been meant for you.">\n${asides}\n</said_just_before>` : "",
    ...(await prefetchedFacts(ctx, asideTexts)),
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
    lookupsTaken: 0,
    webLookupsTaken: 0,
    toolsUsed: 0,
    postedByAction: false,
    heldReply: "",
    silent: false,
  }
}

// Run the tool loop and return the final reply text. Empty = nothing to say.
const runConversation = async (
  ctx: ToolContext,
  history: Anthropic.Beta.BetaMessageParam[],
  userTurn: string,
): Promise<string> => {
  const tools = toolsFor(ctx)
  const messages: Anthropic.Beta.BetaMessageParam[] = [...history, { role: "user", content: userTurn }]
  let reply = ""
  let retriedCutOff = false

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    // The last round can't call tools, so work done by earlier rounds always ends in a reply
    const lastRound = i === MAX_ITERATIONS - 1
    const request = (maxTokens?: number) =>
      createAIMessage(ctx.settings.ai_bot, messages, tools, {
        toolChoice: lastRound ? { type: "none" } : undefined,
        historyLength: history.length,
        maxTokens,
      })

    let response = await request()

    // Cut off mid tool call or before saying anything: retry once with more room rather than
    // sending a lead-in like "Let me check..." with nothing after it
    const cutOff = response.stop_reason === "max_tokens" && (responseToolCalls(response).length || !responseText(response))
    if (cutOff && !retriedCutOff) {
      retriedCutOff = true
      response = await request(getModelConfig(ctx.settings.ai_bot.model).maxTokens * CUT_OFF_RETRY_MULTIPLIER)
    }

    if (response.stop_reason === "refusal") return randomInCharacterDeflection()

    // A reply cut off by the token ceiling is trimmed back to its last complete thought
    if (response.stop_reason === "max_tokens") return trimToCleanEnding(responseText(response))

    reply = responseText(response)
    const toolCalls = responseToolCalls(response)
    if (!toolCalls.length || response.stop_reason !== "tool_use") break

    messages.push({ role: "assistant", content: response.content })

    const toolResults: Anthropic.Beta.BetaToolResultBlockParam[] = []
    for (const call of toolCalls) {
      ctx.toolsUsed++
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

// What to send when the model came back with no text, so the user is never left hanging.
// A held action reply always goes out as written, since the action already happened.
// Otherwise, if a tool did something, a short acknowledgement.
const fallbackReply = (ctx: ToolContext): string => {
  if (ctx.heldReply) return ctx.heldReply
  if (ctx.silent) return ""
  if (ctx.toolsUsed && !ctx.postedByAction) {
    logger.info(`AI Bot | Came back with an empty reply after a tool for ${ctx.identity.username}. Sent an acknowledgement.`)
    return randomAcknowledgement()
  }
  return ""
}

// Hold on to a message the AI couldn't answer, so it's still in context when the user next gets a reply
const keepForLater = (message: Message, failed?: FailedCommand): void => {
  if (!failed) recordAside(message.channel.id, message.author.id, resolveMentions(message))
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
    keepForLater(message, failed)
    return "limited"
  }

  let ctx: ToolContext | undefined

  try {
    if (await budgetExhausted(aiBot)) {
      logger.warn("AI Bot | Monthly budget reached.")
      keepForLater(message, failed)
      return "unavailable"
    }

    noteEngagement(message.author.id)

    ctx = await buildToolContext(message, settings, isAdmin)
    const history = historyTurns(message)
    const userTurn = await buildUserTurn(ctx, reason, failed)

    // Record the message after building the transcript so it isn't duplicated in the context
    if (!failed) recordUserMessage(message.channel.id, message.author.id, resolveMentions(message))
    checkReturningUser(ctx.identity, await touchActivity(ctx.identity))

    if (reason !== "passing" && "sendTyping" in message.channel) {
      await message.channel.sendTyping().catch(() => undefined)
    }

    const reply = guardReply(await runConversation(ctx, history, userTurn)) || fallbackReply(ctx)
    clearAsides(message.channel.id, message.author.id)

    if (reply) {
      await sendDiscordMessage(message, reply, { parse: [], repliedUser: false })
    } else if (!ctx.silent && !ctx.postedByAction) {
      logger.info(`AI Bot | Came back with an empty reply for ${ctx.identity.username}.`)
    }

    return "handled"
  } catch (err) {
    logger.error(`AI Bot | ${describeAIError(err)}`)

    // An action already ran and its reply was held for the AI. Send it as written so it isn't lost.
    if (ctx?.heldReply) {
      await sendDiscordMessage(message, ctx.heldReply, { parse: [], repliedUser: false })
      return "handled"
    }

    return "unavailable"
  }
}
