import { GuildTextBasedChannel, Message } from "discord.js"
import logger from "../../../../logger"
import { truncateText } from "../../../../shared/utility"
import { findChannelByName, sendDiscordMessage } from "../../discordBotUtility"
import { randomCrashedMessage } from "../../discordBotRandomReply"
import { caseDownloadSwitch } from "../../discordBotContentListeners"
import { caseStats } from "../../discordBotUserListeners"
import { caseRemove } from "../../cases/discordBotcaseRemove"
import { caseList } from "../../cases/discordBotcaseList"
import { caseSearch } from "../../cases/discordBotcaseSearch"
import { caseWaitTime } from "../../cases/discordBotcaseWaitTime"
import { caseStay } from "../../cases/discordBotcaseStay"
import { caseMonitor } from "../../cases/discordBotcaseMonitor"
import { caseBlocklist } from "../../cases/discordBotcaseBlocklist"
import { buildCommandMessage } from "../aiCommandMessage"
import { ToolContext, ToolHandler, ToolInput, inputString, inputYear } from "./aiToolTypes"

// Only one action per engagement so the channel doesn't fill with command output
const MAX_ACTIONS_PER_ENGAGEMENT = 1

type ContentType = "movie" | "series"

type ActionDefinition = {
  build: (input: ToolInput) => string | null // Build the ! command, or null if input is incomplete
  run: (message: Message) => Promise<string> // The existing command handler
  channel?: (input: ToolInput) => ContentType | null // Which content channel it runs in. Absent = current channel
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
  list_pool: { build: () => "!list", run: (m) => caseList(m), channel: inputContentType },
  search_library: {
    build: (input) => titleYearCommand("!search", input),
    run: (m) => caseSearch(m),
    channel: inputContentType,
  },
  wait_time: {
    build: (input) => titleYearCommand("!waittime", input),
    run: (m) => caseWaitTime(m),
    channel: inputContentType,
  },
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
  stats: { build: () => "!stats", run: (m) => caseStats(m) },
}

// Find the configured movie or series channel
const contentChannel = (ctx: ToolContext, type: ContentType): GuildTextBasedChannel | undefined => {
  const { movie_channel_name, series_channel_name } = ctx.settings.discord_bot
  return findChannelByName(type === "movie" ? movie_channel_name : series_channel_name).textBasedChannel
}

// Run a ! command as the speaker and report what it posted back to the model.
// Content commands always run in the matching movie or series channel, wherever the user asked.

const runAction = (name: string): ToolHandler => async (ctx: ToolContext, input: ToolInput) => {
  const action = ACTIONS[name]

  if (ctx.actionsTaken >= MAX_ACTIONS_PER_ENGAGEMENT) {
    return "Not run. Only one action per message. Tell the user to ask again for the next one."
  }

  const command = action.build(input)
  if (!command) return "Not run. A title and 4 digit year are required."

  let target: GuildTextBasedChannel | undefined

  if (action.channel) {
    const type = action.channel(input)
    if (!type) return "Not run. Say whether it's a movie or a series."

    target = contentChannel(ctx, type)
    if (!target) return `Not run. No ${type} channel is set up in Automatarr. Tell them to ask an admin.`
  }

  ctx.actionsTaken++
  ctx.postedByAction = true

  const synthetic = buildCommandMessage(ctx.message, command, target)
  const where = target ? `in <#${target.id}>${target.id !== ctx.message.channel.id ? ", not the channel you're chatting in" : ""}` : "here"
  logger.bot(`AI Bot | ${ctx.identity.username} | Running \`${command}\` ${target ? `in #${target.name}` : ""}`)

  try {
    const reply = await action.run(synthetic)
    await sendDiscordMessage(synthetic, reply)

    return reply
      ? `Ran \`${command}\` ${where}. It posted: "${truncateText(reply, 300)}"`
      : `Ran \`${command}\` ${where}. It posted its results there.`
  } catch (err) {
    logger.error(`AI Bot | \`${command}\` crashed: ${err}`)
    await sendDiscordMessage(synthetic, randomCrashedMessage(err))
    return `\`${command}\` crashed and an error was posted.`
  }
}

// Handlers for every action tool, keyed by tool name
export const ACTION_HANDLERS: Record<string, ToolHandler> = Object.fromEntries(
  Object.keys(ACTIONS).map((name) => [name, runAction(name)]),
)
