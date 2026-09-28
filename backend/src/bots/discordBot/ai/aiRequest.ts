import Anthropic from "@anthropic-ai/sdk"
import { AIBotType } from "../../../models/settings"
import { AI_MODELS, FALLBACK_BETA, getAIClient, getModelConfig } from "./aiClient"
import { recordUsage } from "./aiBudget"
import { AUTOMATARR_PERSONA } from "./aiPersona"

// Send one request to Claude with Automatarr's persona, then record its usage and cost.
// The persona and tool list come first and never change, so Sonnet and Opus can cache them.
export const createAIMessage = async (
  aiBot: AIBotType,
  messages: Anthropic.Beta.BetaMessageParam[],
  tools: Anthropic.Beta.BetaTool[],
): Promise<Anthropic.Beta.BetaMessage> => {
  const model = getModelConfig(aiBot.model)
  const client = getAIClient(aiBot)

  const params: Anthropic.Beta.Messages.MessageCreateParamsNonStreaming = {
    model: model.id,
    max_tokens: model.maxTokens,
    system: [
      {
        type: "text",
        text: AUTOMATARR_PERSONA,
        ...(model.cacheable ? { cache_control: { type: "ephemeral" as const } } : {}),
      },
    ],
    tools,
    messages,
    ...(model.thinking ? { thinking: { type: "adaptive" as const }, output_config: { effort: "low" as const } } : {}),
    ...(model.fallbacks ? { betas: [FALLBACK_BETA], fallbacks: "default" as const } : {}),
  }

  const response = await client.beta.messages.create(params)

  // A fallback model may have served the request. Price it as the requested model if it's unknown.
  const billedModel = AI_MODELS.some((m) => m.id === response.model) ? response.model : model.id
  await recordUsage(billedModel, response.usage)

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
