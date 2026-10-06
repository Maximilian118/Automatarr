import Anthropic from "@anthropic-ai/sdk"
import logger from "../../../logger"
import {
  ACTION_TOOLS,
  ADMIN_TOOLS,
  INFO_TOOLS,
  PLEX_ADMIN_TOOLS,
  PLEX_TOOLS,
  SELF_TOOLS,
  WEB_TOOLS,
} from "./tools/aiToolDefinitions"
import { ACTION_HANDLERS } from "./tools/aiActionTools"
import { INFO_HANDLERS } from "./tools/aiInfoTools"
import { PLEX_LINK_HANDLERS } from "./tools/aiPlexTools"
import { SELF_HANDLERS } from "./tools/aiSelfTools"
import { WEB_HANDLERS } from "./tools/aiWebTools"
import { SERVER_HANDLERS } from "./tools/aiServerTools"
import { ToolContext, ToolHandler, ToolInput } from "./tools/aiToolTypes"

// Find the handler for a tool name. Looked up at call time because the action tools
// import the command handlers, which import the AI, which imports this file.
const handlerFor = (name: string): ToolHandler | undefined =>
  ACTION_HANDLERS[name] ??
  INFO_HANDLERS[name] ??
  SERVER_HANDLERS[name] ??
  WEB_HANDLERS[name] ??
  PLEX_LINK_HANDLERS[name] ??
  SELF_HANDLERS[name]

// Build the tool list for this speaker. Admin tools only exist for admins, so the model
// can't be talked into using them. The order is fixed so the prompt cache stays valid.
export const toolsFor = (ctx: ToolContext): Anthropic.Beta.BetaTool[] => [
  ...ACTION_TOOLS,
  ...INFO_TOOLS,
  ...(ctx.settings.ai_bot.web_search ? WEB_TOOLS : []),
  ...(ctx.settings.plex_active ? PLEX_TOOLS : []),
  ...SELF_TOOLS,
  ...(ctx.isAdmin ? ADMIN_TOOLS : []),
  ...(ctx.isAdmin && ctx.settings.plex_active ? PLEX_ADMIN_TOOLS : []),
]

// Run a tool the model asked for, but only if it was offered to this speaker
export const runTool = async (
  ctx: ToolContext,
  offered: Anthropic.Beta.BetaTool[],
  name: string,
  input: unknown,
): Promise<{ content: string; isError: boolean }> => {
  const handler = handlerFor(name)

  if (!handler || !offered.some((t) => t.name === name)) {
    return { content: `Unknown tool "${name}".`, isError: true }
  }

  const safeInput: ToolInput = input && typeof input === "object" ? (input as ToolInput) : {}
  logger.info(`AI Bot | ${ctx.identity.username} | Tool ${name} ${JSON.stringify(safeInput).slice(0, 200)}`)

  try {
    return { content: await handler(ctx, safeInput), isError: false }
  } catch (err) {
    logger.error(`AI Bot | Tool ${name} failed: ${err}`)
    return { content: `The ${name} tool failed.`, isError: true }
  }
}
