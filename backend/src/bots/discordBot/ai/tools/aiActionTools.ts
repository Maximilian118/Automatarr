import { GuildTextBasedChannel, Message } from "discord.js"
import logger from "../../../../logger"
import { truncateText } from "../../../../shared/utility"
import { findChannelByName, sendDiscordMessage } from "../../discordBotUtility"
import { randomCrashedMessage } from "../../discordBotRandomReply"
import { caseDownloadSwitch } from "../../discordBotContentListeners"
import { caseStats } from "../../discordBotUserListeners"
import { caseRemove } from "../../cases/discordBotcaseRemove"
import { caseList } from "../../cases/discordBotcaseList"
import { caseStay } from "../../cases/discordBotcaseStay"
import { caseMonitor } from "../../cases/discordBotcaseMonitor"
import { caseBlocklist } from "../../cases/discordBotcaseBlocklist"
import { buildCommandMessage } from "../aiCommandMessage"
import { recordUserEvent } from "../aiContext"
import { describeDownloadState, getDownloadSnapshot, stateFor } from "../../../../shared/downloadStatus"
import { ensureTitleIndex, searchTitleIndex } from "../aiTitleIndex"
import { ToolContext, ToolHandler, ToolInput, inputBoolean, inputString, inputYear } from "./aiToolTypes"
import { withActivitySource } from "../../../../shared/activity"

// Only one content changing action per engagement so the channel doesn't fill with command output
const MAX_ACTIONS_PER_ENGAGEMENT = 1

// Read-only actions only post information, so a couple are allowed, e.g. both pools for "show my list"
const MAX_LOOKUPS_PER_ENGAGEMENT = 2

// Longest held reply passed back to the model to fold into its own
const MAX_HELD_REPLY_LENGTH = 1000

type ContentType = "movie" | "series"

type ActionDefinition = {
  build: (input: ToolInput) => string | null // Build the ! command, or null if input is incomplete
  run: (message: Message) => Promise<string> // The existing command handler
  channel?: (input: ToolInput) => ContentType | null // Which content channel it runs in. Absent = current channel
  readOnly?: boolean // Only posts information and changes nothing
}

// Read the content type the model chose
const inputContentType = (input: ToolInput): ContentType | null =>
  input.type === "movie" || input.type === "series" ? input.type : null

// Build "<command> <title> <year>" from tool input
const titleYearCommand = (command: string, input: ToolInput, ...extra: string[]): string | null => {
  const title = inputString(input, "title")
  const year = inputYear(input)
  if (!title || !year) return null

  return [command, title, String(year), ...extra].filter(Boolean).join(" ")
}

// Every action tool maps to an existing ! command handler.
// Handlers are wrapped in arrow functions so circular imports resolve at call time.
const ACTIONS: Record<string, ActionDefinition> = {
  download: {
    build: (input) =>
      titleYearCommand("!download", input, inputString(input, "quality", 10), inputString(input, "monitor", 20)),
    run: (m) => caseDownloadSwitch(m),
    channel: inputContentType,
  },
  remove: { build: (input) => titleYearCommand("!remove", input), run: (m) => caseRemove(m), channel: inputContentType },
  list_pool: { build: () => "!list", run: (m) => caseList(m), channel: inputContentType, readOnly: true },
  stay: { build: (input) => titleYearCommand("!stay", input), run: (m) => caseStay(m), channel: inputContentType },
  monitor: {
    build: (input) => {
      const option = inputString(input, "option", 20)
      return option ? titleYearCommand("!monitor", input, option) : null
    },
    run: (m) => caseMonitor(m),
    channel: () => "series",
  },
  blocklist: {
    build: (input) => titleYearCommand("!blocklist", input, inputString(input, "episode", 10)),
    run: (m) => caseBlocklist(m),
    channel: inputContentType,
  },
  stats: { build: () => "!stats", run: (m) => caseStats(m), readOnly: true },
}

// Find the configured movie or series channel
const contentChannel = (ctx: ToolContext, type: ContentType): GuildTextBasedChannel | undefined => {
  const { movie_channel_name, series_channel_name } = ctx.settings.discord_bot
  return findChannelByName(type === "movie" ? movie_channel_name : series_channel_name).textBasedChannel
}

// Check whether another action of this kind is allowed this engagement, and count it if so.
// Returns why it isn't allowed, or an empty string.
const claimActionSlot = (ctx: ToolContext, action: ActionDefinition): string => {
  if (action.readOnly) {
    if (ctx.lookupsTaken >= MAX_LOOKUPS_PER_ENGAGEMENT) return "Not run. That's enough lookups for one message."
    ctx.lookupsTaken++
    return ""
  }

  if (ctx.actionsTaken >= MAX_ACTIONS_PER_ENGAGEMENT) {
    return "Not run. Only one action per message. Tell the user to ask again for the next one."
  }
  ctx.actionsTaken++
  return ""
}

// Hand a command's text reply to the AI when it ran where the user is chatting, so the user gets
// one message instead of the command's reply plus the AI's. Elsewhere it posts as normal, and is
// noted for the user so the AI knows about it later, wherever they chat.
const deliverReply = async (
  ctx: ToolContext,
  synthetic: Message,
  command: string,
  where: string,
  reply: string,
  sameChannel: boolean,
): Promise<string> => {
  if (!reply) {
    ctx.postedByAction = true
    if (!sameChannel) recordUserEvent(ctx.identity.id, `You ran \`${command}\` for them ${where} and it posted its results there.`)
    return `Ran \`${command}\` ${where}. It posted its results there.`
  }

  if (sameChannel) {
    ctx.heldReply = [ctx.heldReply, reply].filter(Boolean).join("\n")
    return `Ran \`${command}\` ${where}. Its reply was held for you, so fold it into your one reply: "${truncateText(reply, MAX_HELD_REPLY_LENGTH)}"`
  }

  ctx.postedByAction = true
  await sendDiscordMessage(synthetic, reply)
  recordUserEvent(ctx.identity.id, `You ran \`${command}\` for them ${where}. It said: "${reply}"`)

  return `Ran \`${command}\` ${where}. It already posted its own reply there: "${truncateText(reply, 300)}"`
}

// A library title matching the year exactly scores at least this, so a quality switch check can't hit the wrong one
const EXACT_TITLE_SCORE = 120

// A download with a quality on a title that's already downloading cancels the running download and searches
// again. Unless the model says the user confirmed, return what's downloading so it can ask first.
// Returns an empty string when the download can go ahead.
const qualitySwitchCheck = async (ctx: ToolContext, input: ToolInput): Promise<string> => {
  const quality = inputString(input, "quality", 10)
  const type = inputContentType(input)
  if (!quality || !type || inputBoolean(input, "confirm_switch")) return ""

  await ensureTitleIndex()
  const [match] = searchTitleIndex(inputString(input, "title"), { year: inputYear(input), type, limit: 1 })
  if (!match || match.score < EXACT_TITLE_SCORE) return ""

  const state = stateFor(await getDownloadSnapshot(ctx.settings, [type]), type, match.item.id)
  if (!state) return ""

  return `Not run. ${match.item.title} is already in the download queue: ${describeDownloadState(state)}. Getting it in ${quality} cancels that and searches again, which may take longer. Tell them and ask first. If they confirm, call download again with confirm_switch: true.`
}

// Describe a channel for the model by name and mention, e.g. "#films (<#123>)", so it can name it correctly
const channelLabel = (channel: GuildTextBasedChannel): string => `#${channel.name} (<#${channel.id}>)`

// Run a ! command as the speaker and report what it posted back to the model.
// Content commands always run in the matching movie or series channel, wherever the user asked.
const runAction = (name: string): ToolHandler => async (ctx: ToolContext, input: ToolInput) => {
  const action = ACTIONS[name]

  const command = action.build(input)
  if (!command) return "Not run. A title and 4 digit year are required."

  let target: GuildTextBasedChannel | undefined

  if (action.channel) {
    const type = action.channel(input)
    if (!type) return "Not run. Say whether it's a movie or a series."

    target = contentChannel(ctx, type)
    if (!target) return `Not run. No ${type} channel is set up in Automatarr. Tell them to ask an admin.`
  }

  if (name === "download") {
    const switchWarning = await qualitySwitchCheck(ctx, input)
    if (switchWarning) return switchWarning
  }

  const refused = claimActionSlot(ctx, action)
  if (refused) return refused

  const synthetic = buildCommandMessage(ctx.message, command, target)
  const elsewhere = target && target.id !== ctx.message.channel.id ? target : undefined
  const where = elsewhere ? `in ${channelLabel(elsewhere)}, not the channel you're chatting in` : "here"
  logger.bot(`AI Bot | ${ctx.identity.username} | Running \`${command}\` ${target ? `in #${target.name}` : ""}`)

  try {
    // Attribute any removals an AI action makes to the Discord bot
    const reply = await withActivitySource("discord", () => action.run(synthetic))
    return deliverReply(ctx, synthetic, command, where, reply, !elsewhere)
  } catch (err) {
    logger.error(`AI Bot | \`${command}\` crashed: ${err}`)
    ctx.postedByAction = true
    await sendDiscordMessage(synthetic, randomCrashedMessage(err))
    return `\`${command}\` crashed and an error was posted.`
  }
}

// Handlers for every action tool, keyed by tool name
export const ACTION_HANDLERS: Record<string, ToolHandler> = Object.fromEntries(
  Object.keys(ACTIONS).map((name) => [name, runAction(name)]),
)
