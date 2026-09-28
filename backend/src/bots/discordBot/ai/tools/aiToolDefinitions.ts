import Anthropic from "@anthropic-ai/sdk"

type Tool = Anthropic.Beta.BetaTool

// Shared schema pieces
const titleYear = {
  title: { type: "string", description: "The film or series title, without the year." },
  year: { type: "integer", description: "The 4 digit release year." },
}

const preferenceFlags = {
  private: {
    type: "boolean",
    description: "true = never mention their personal info in shared channels.",
  },
  learning: { type: "boolean", description: "false = stop remembering new things about them." },
  chat: { type: "boolean", description: "false = only reply when they address you directly." },
  recommendations: { type: "boolean", description: "false = no unprompted recommendations." },
}

// Tools that run a ! command as the speaker. They post their own reply to the channel.
export const ACTION_TOOLS: Tool[] = [
  {
    name: "download",
    description:
      "Download a film (in the movie channel) or series (in the series channel) and add it to the speaker's pool. Same as !download.",
    input_schema: {
      type: "object",
      properties: {
        ...titleYear,
        quality: { type: "string", description: "Optional quality, e.g. 4k, 1080p, 720p." },
        monitor: {
          type: "string",
          description: "Optional series monitor option: all, future, missing, existing, recent, pilot, firstSeason, lastSeason.",
        },
      },
      required: ["title", "year"],
    },
  },
  {
    name: "remove",
    description: "Remove a film or series from the speaker's own pool. Same as !remove.",
    input_schema: { type: "object", properties: titleYear, required: ["title", "year"] },
  },
  {
    name: "list_pool",
    description: "Post the speaker's pool for the current channel's content type. Same as !list.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "search_library",
    description: "Post which users have a title in their pools. Same as !search.",
    input_schema: { type: "object", properties: titleYear, required: ["title", "year"] },
  },
  {
    name: "wait_time",
    description: "Post how long a download has left. Same as !waittime.",
    input_schema: { type: "object", properties: titleYear, required: ["title", "year"] },
  },
  {
    name: "stay",
    description: "Keep a title in the library a while longer. Same as !stay.",
    input_schema: { type: "object", properties: titleYear, required: ["title", "year"] },
  },
  {
    name: "monitor",
    description: "Change which episodes of a series are downloaded. Same as !monitor.",
    input_schema: {
      type: "object",
      properties: {
        ...titleYear,
        option: {
          type: "string",
          description: "all, future, missing, existing, recent, pilot, firstSeason, lastSeason, monitorSpecials or unmonitorSpecials.",
        },
      },
      required: ["title", "year", "option"],
    },
  },
  {
    name: "blocklist",
    description:
      "Mark a bad download as a dud, blocklist it and find another. Same as !blocklist. Series need an episode.",
    input_schema: {
      type: "object",
      properties: {
        ...titleYear,
        episode: { type: "string", description: "For series only, e.g. S02E04." },
      },
      required: ["title", "year"],
    },
  },
  {
    name: "stats",
    description: "Post the speaker's pool stats. Same as !stats.",
    input_schema: { type: "object", properties: {} },
  },
]

// Read-only tools that return information to you without posting anything
export const INFO_TOOLS: Tool[] = [
  {
    name: "lookup_title",
    description:
      "Look up a film or series in the server's library: whether it's downloaded, ratings, genres and who has it in their pool.",
    input_schema: {
      type: "object",
      properties: {
        title: titleYear.title,
        year: { type: "integer", description: "Optional release year to narrow it down." },
      },
      required: ["title"],
    },
  },
  {
    name: "lookup_media",
    description:
      "Look up any film or series, even if it's not in the library. Returns titles, years, overviews and ratings from TMDB/TVDB.",
    input_schema: {
      type: "object",
      properties: {
        title: titleYear.title,
        type: { type: "string", enum: ["movie", "series"] },
      },
      required: ["title", "type"],
    },
  },
  {
    name: "get_user_profile",
    description:
      "Get a server member's public info (name and pool). Leave user empty for the speaker, who also gets their own remembered facts and habits.",
    input_schema: {
      type: "object",
      properties: {
        user: { type: "string", description: "Optional Discord username, display name or mention." },
      },
    },
  },
]

// Plex tools, only offered when Plex is connected
export const PLEX_TOOLS: Tool[] = [
  {
    name: "plex_now_playing",
    description: "What the speaker is watching on Plex right now.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "plex_recent_history",
    description: "What the speaker has watched recently on Plex.",
    input_schema: { type: "object", properties: {} },
  },
]

// Tools for the speaker's own memory and preferences
export const SELF_TOOLS: Tool[] = [
  {
    name: "remember",
    description: "Remember a short fact about the speaker for future conversations.",
    input_schema: {
      type: "object",
      properties: { fact: { type: "string", description: "One short fact, under 200 characters." } },
      required: ["fact"],
    },
  },
  {
    name: "set_my_preferences",
    description: "Change the speaker's own privacy and interaction preferences. Only include what they asked to change.",
    input_schema: { type: "object", properties: preferenceFlags },
  },
  {
    name: "forget_me",
    description: "Permanently forget everything remembered about the speaker. Only when they explicitly ask.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "send_my_data_by_dm",
    description: "Privately DM the speaker everything you remember about them and their preferences.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "stay_silent",
    description: "Don't reply to this message at all.",
    input_schema: { type: "object", properties: {} },
  },
]

// Tools only offered when the speaker is an Automatarr admin
export const ADMIN_TOOLS: Tool[] = [
  {
    name: "set_user_preferences",
    description:
      "Admin only. Change another member's preferences, e.g. stop recommendations for them.",
    input_schema: {
      type: "object",
      properties: {
        user: { type: "string", description: "Their Discord username, display name or mention." },
        ...preferenceFlags,
      },
      required: ["user"],
    },
  },
]

// A tool used only when writing proactive recommendations
export const RECOMMEND_TOOL: Tool = {
  name: "recommend",
  description: "Recommend one of the numbered candidates.",
  input_schema: {
    type: "object",
    properties: {
      candidate: { type: "integer", description: "The candidate's number." },
      message: { type: "string", description: "One or two in-character sentences." },
    },
    required: ["candidate", "message"],
  },
}
