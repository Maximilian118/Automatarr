import Anthropic from "@anthropic-ai/sdk"
import logger from "../../../logger"
import { AIBotType } from "../../../models/settings"
import { AI_MODELS, FALLBACK_BETA, getAIClient, getModelConfig } from "./aiClient"
import { recordUsage } from "./aiBudget"
import { AUTOMATARR_PERSONA } from "./aiPersona"

// Optional settings for a single request
export type AIRequestOptions = {
  toolChoice?: Anthropic.Beta.BetaToolChoice // e.g. { type: "none" } to force a text reply
  maxTokens?: number // Override the model's output ceiling, e.g. to retry a cut off reply
  historyLength?: number // How many messages are earlier conversation, so that stretch can be cached
}

const EPHEMERAL = { type: "ephemeral" as const }

// Add a cache breakpoint to the last block of a message. String content is turned into a text block to carry it.
const withBreakpoint = (message: Anthropic.Beta.BetaMessageParam): Anthropic.Beta.BetaMessageParam => {
  if (typeof message.content === "string") {
    return { ...message, content: [{ type: "text", text: message.content, cache_control: EPHEMERAL }] }
  }

  const blocks = [...message.content]
  const last = blocks[blocks.length - 1]
  if (last && "type" in last && last.type !== "thinking" && last.type !== "redacted_thinking") {
    blocks[blocks.length - 1] = { ...last, cache_control: EPHEMERAL } as typeof last
  }
  return { ...message, content: blocks }
}

// Mark where the prompt cache should save its place: the end of the earlier conversation, which the
// next message in the same conversation starts with, and the end of this request, which the next tool
// round starts with. Together with the system prompt that's three of the four breakpoints allowed.
const withCacheBreakpoints = (
  messages: Anthropic.Beta.BetaMessageParam[],
  historyLength: number,
): Anthropic.Beta.BetaMessageParam[] =>
  messages.map((message, i) =>
    i === messages.length - 1 || (historyLength > 0 && i === historyLength - 1) ? withBreakpoint(message) : message,
  )

// Send one request to Claude with Automatarr's persona, then record its usage and cost.
// The tool list and persona come first and never change, so they're cached along with the conversation so far.
export const createAIMessage = async (
  aiBot: AIBotType,
  messages: Anthropic.Beta.BetaMessageParam[],
  tools: Anthropic.Beta.BetaTool[],
  options: AIRequestOptions = {},
): Promise<Anthropic.Beta.BetaMessage> => {
  const model = getModelConfig(aiBot.model)
  const client = getAIClient(aiBot)

  const params: Anthropic.Beta.Messages.MessageCreateParamsNonStreaming = {
    model: model.id,
    max_tokens: options.maxTokens ?? model.maxTokens,
    system: [
      {
        type: "text",
        text: AUTOMATARR_PERSONA,
        ...(model.cacheable ? { cache_control: EPHEMERAL } : {}),
      },
    ],
    tools,
    ...(options.toolChoice ? { tool_choice: options.toolChoice } : {}),
    messages: model.cacheable ? withCacheBreakpoints(messages, options.historyLength ?? 0) : messages,
    ...(model.thinking ? { thinking: { type: "adaptive" as const }, output_config: { effort: "low" as const } } : {}),
    ...(model.fallbacks ? { betas: [FALLBACK_BETA], fallbacks: "default" as const } : {}),
  }

  const response = await client.beta.messages.create(params)

  // A fallback model may have served the request. Price it as the requested model if it's unknown.
  const billedModel = AI_MODELS.some((m) => m.id === response.model) ? response.model : model.id
  const cost = await recordUsage(billedModel, response.usage)
  const { usage } = response

  logger.info(
    `AI Bot | Usage: ${usage.input_tokens} in, ${usage.cache_read_input_tokens ?? 0} cache read, ${usage.cache_creation_input_tokens ?? 0} cache write, ${usage.output_tokens} out, $${cost.toFixed(4)}`,
  )

  return response
}

// Join the text blocks of a response into a single reply
export const responseText = (response: Anthropic.Beta.BetaMessage): string =>
  response.content
    .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim()

// Get the tool calls from a response
export const responseToolCalls = (response: Anthropic.Beta.BetaMessage): Anthropic.Beta.BetaToolUseBlock[] =>
  response.content.filter((b): b is Anthropic.Beta.BetaToolUseBlock => b.type === "tool_use")
