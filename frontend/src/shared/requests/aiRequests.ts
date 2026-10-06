import axios from "axios"
import { getAxiosErrorMessage, headers } from "./requestUtility"
import { populateSettings } from "./requestPopulation"
import { AIModel, AIUsage, BotMemory, BotMemoryPreferences, NicknameTarget, PlexAccountOption } from "../../types/aiType"
import { settingsType } from "../../types/settingsType"

// Population fields for a bot memory request
const populateBotMemories = `
  data {
    discord_id
    username
    notes {
      text
      created_at
    }
    nicknames
    bot_nicknames
    preferences {
      private
      learning
      chat
      recommendations
    }
    last_active_at
    last_recommended_at
  }
  tokens
`

// Send a GraphQL request with the stored token and return the named field. Throws on errors.
const aiRequest = async <T>(
  field: string,
  query: string,
  variables?: Record<string, unknown>,
): Promise<T> => {
  try {
    const userToken = localStorage.getItem("access_token")
    const res = await axios.post("", { query, variables }, { headers: headers(userToken || "") })

    if (res.data.errors) {
      console.error(`${field} Error: ${res.data.errors[0].message}`)
      throw new Error(res.data.errors[0].message)
    }

    return res.data.data[field] as T
  } catch (err) {
    console.error(getAxiosErrorMessage(err))
    throw err
  }
}

// Get the Claude models selectable for the AI bot
export const getAIModels = async (): Promise<AIModel[]> => {
  const res = await aiRequest<{ data: AIModel[] }>(
    "getAIModels",
    `query { getAIModels { data { id label inputPerM outputPerM } tokens } }`,
  )
  return res.data
}

// Get this month's AI token usage and estimated spend
export const getAIUsage = async (): Promise<AIUsage> => {
  const res = await aiRequest<{ data: AIUsage }>(
    "getAIUsage",
    `query {
      getAIUsage {
        data { month requests input_tokens output_tokens cache_read_tokens cache_write_tokens web_searches cost_usd }
        tokens
      }
    }`,
  )
  return res.data
}

// Get everything the AI remembers about each Discord user
export const getBotMemories = async (): Promise<BotMemory[]> => {
  const res = await aiRequest<{ data: BotMemory[] }>(
    "getBotMemories",
    `query { getBotMemories { ${populateBotMemories} } }`,
  )
  return res.data
}

// Delete one remembered note for a Discord user
export const deleteBotMemoryNote = async (discord_id: string, index: number): Promise<BotMemory[]> => {
  const res = await aiRequest<{ data: BotMemory[] }>(
    "deleteBotMemoryNote",
    `mutation DeleteBotMemoryNote($discord_id: String!, $index: Int!) {
      deleteBotMemoryNote(discord_id: $discord_id, index: $index) { ${populateBotMemories} }
    }`,
    { discord_id, index },
  )
  return res.data
}

// Delete one nickname. target "them" is what Automatarr calls the user, "you" is what the user calls Automatarr.
export const deleteBotNickname = async (
  discord_id: string,
  target: NicknameTarget,
  index: number,
): Promise<BotMemory[]> => {
  const res = await aiRequest<{ data: BotMemory[] }>(
    "deleteBotNickname",
    `mutation DeleteBotNickname($discord_id: String!, $target: String!, $index: Int!) {
      deleteBotNickname(discord_id: $discord_id, target: $target, index: $index) { ${populateBotMemories} }
    }`,
    { discord_id, target, index },
  )
  return res.data
}

// Forget everything the AI remembers about a Discord user
export const forgetBotUser = async (discord_id: string): Promise<BotMemory[]> => {
  const res = await aiRequest<{ data: BotMemory[] }>(
    "forgetBotUser",
    `mutation ForgetBotUser($discord_id: String!) {
      forgetBotUser(discord_id: $discord_id) { ${populateBotMemories} }
    }`,
    { discord_id },
  )
  return res.data
}

// Change a Discord user's AI preferences
export const updateBotMemoryPreferences = async (
  discord_id: string,
  changes: Partial<BotMemoryPreferences>,
): Promise<BotMemory[]> => {
  const res = await aiRequest<{ data: BotMemory[] }>(
    "updateBotMemoryPreferences",
    `mutation UpdateBotMemoryPreferences(
      $discord_id: String!, $private: Boolean, $learning: Boolean, $chat: Boolean, $recommendations: Boolean
    ) {
      updateBotMemoryPreferences(
        discord_id: $discord_id, private: $private, learning: $learning, chat: $chat, recommendations: $recommendations
      ) { ${populateBotMemories} }
    }`,
    { discord_id, ...changes },
  )
  return res.data
}

// Get every Plex account on the server and who each is linked to
export const getPlexAccounts = async (): Promise<PlexAccountOption[]> => {
  const res = await aiRequest<{ data: PlexAccountOption[] }>(
    "getPlexAccounts",
    `query { getPlexAccounts { data { id name linked_to } tokens } }`,
  )
  return res.data
}

// Link a bot user to a Plex account, or unlink them with null
export const updateUserPlexLink = async (
  userId: string,
  plexAccountId: number | null,
): Promise<settingsType> =>
  aiRequest<settingsType>(
    "updateUserPlexLink",
    `mutation UpdateUserPlexLink($userId: String!, $plexAccountId: Int) {
      updateUserPlexLink(userId: $userId, plexAccountId: $plexAccountId) { ${populateSettings} }
    }`,
    { userId, plexAccountId },
  )

// Check an Anthropic API key works. Free, because it only lists models.
// Returns whether it works and, if not, the reason.
export const checkClaude = async (KEY: string): Promise<{ ok: boolean; message: string }> => {
  const res = await aiRequest<{ data: number; message: string | null }>(
    "checkClaude",
    `query CheckClaude($KEY: String) { checkClaude(KEY: $KEY) { data message tokens } }`,
    { KEY },
  )
  return { ok: Number(res.data) === 200, message: res.message ?? "" }
}
