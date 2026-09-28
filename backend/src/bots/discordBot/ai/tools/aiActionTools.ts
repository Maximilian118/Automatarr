import { Message } from "discord.js"
import logger from "../../../../logger"
import { truncateText } from "../../../../shared/utility"
import { sendDiscordMessage } from "../../discordBotUtility"
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

type ActionDefinition = {
  build: (input: ToolInput) => string | null // Build the ! command, or null if input is incomplete
  run: (message: Message) => Promise<string> // The existing command handler
}

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
  },
  remove: { build: (input) => titleYearCommand("!remove", input), run: (m) => caseRemove(m) },
  list_pool: { build: () => "!list", run: (m) => caseList(m) },
  search_library: { build: (input) => titleYearCommand("!search", input), run: (m) => caseSearch(m) },
  wait_time: { build: (input) => titleYearCommand("!waittime", input), run: (m) => caseWaitTime(m) },
  stay: { build: (input) => titleYearCommand("!stay", input), run: (m) => caseStay(m) },
  monitor: {
    build: (input) => {
      const option = inputString(input, "option", 20)
      return option ? titleYearCommand("!monitor", input, option) : null
    },
    run: (m) => caseMonitor(m),
  },
  blocklist: {
    build: (input) => titleYearCommand("!blocklist", input, inputString(input, "episode", 10)),
    run: (m) => caseBlocklist(m),
  },
  stats: { build: () => "!stats", run: (m) => caseStats(m) },
}

// Run a ! command as the speaker and report what it posted back to the model
const runAction = (name: string): ToolHandler => async (ctx: ToolContext, input: ToolInput) => {
  const action = ACTIONS[name]

  if (ctx.actionsTaken >= MAX_ACTIONS_PER_ENGAGEMENT) {
    return "Not run. Only one action per message. Tell the user to ask again for the next one."
  }

  const command = action.build(input)
  if (!command) return "Not run. A title and 4 digit year are required."

  ctx.actionsTaken++
  ctx.postedByAction = true

  const synthetic = buildCommandMessage(ctx.message, command)
  logger.bot(`AI Bot | ${ctx.identity.username} | Running \`${command}\``)

  try {
    const reply = await action.run(synthetic)
    await sendDiscordMessage(synthetic, reply)

    return reply
      ? `Ran \`${command}\`. It posted: "${truncateText(reply, 300)}"`
      : `Ran \`${command}\`. It posted its results to the channel.`
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
