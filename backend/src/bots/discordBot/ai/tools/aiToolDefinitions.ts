import Anthropic from "@anthropic-ai/sdk"

type Tool = Anthropic.Beta.BetaTool

// Shared schema pieces
const titleYear = {
  title: { type: "string", description: "Title without the year." },
  year: { type: "integer", description: "4 digit year." },
}

const contentType = {
  type: {
    type: "string",
    enum: ["movie", "series"],
    description: "Picks the channel it runs in.",
  },
}

// Title, year and content type, which most action tools need
const titleYearType = { ...titleYear, ...contentType }
const titleYearTypeRequired = ["title", "year", "type"]

const preferenceFlags = {
  private: {
    type: "boolean",
    description: "true = keep personal info out of shared channels.",
  },
  learning: { type: "boolean", description: "false = stop remembering things." },
  chat: { type: "boolean", description: "false = only reply when addressed." },
  recommendations: { type: "boolean", description: "false = no unprompted recommendations." },
}

// Tools that run a ! command as the speaker. They always run in the movie or series channel
// matching the content type and post their own output there.
export const ACTION_TOOLS: Tool[] = [
  {
    name: "download",
    description:
      "Download into the speaker's pool (!download). Only pass quality if they named one.",
    input_schema: {
      type: "object",
      properties: {
        ...titleYearType,
        quality: { type: "string", description: "e.g. 4k, 1080p, 720p." },
        monitor: {
          type: "string",
          description: "Series: all, future, missing, existing, recent, pilot, firstSeason, lastSeason.",
        },
        confirm_switch: { type: "boolean", description: "true once they've confirmed switching a running download's quality." },
      },
      required: titleYearTypeRequired,
    },
  },
  {
    name: "remove",
    description: "Remove a title from the speaker's own pool (!remove).",
    input_schema: { type: "object", properties: titleYearType, required: titleYearTypeRequired },
  },
  {
    name: "list_pool",
    description: "Post the speaker's pool (!list).",
    input_schema: { type: "object", properties: contentType, required: ["type"] },
  },
  {
    name: "stay",
    description: "Keep a title in the library a while longer (!stay).",
    input_schema: { type: "object", properties: titleYearType, required: titleYearTypeRequired },
  },
  {
    name: "monitor",
    description: "Change which episodes of a series are downloaded (!monitor).",
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
    description: "Mark a bad download as a dud and find another (!blocklist). Series need an episode.",
    input_schema: {
      type: "object",
      properties: {
        ...titleYearType,
        episode: { type: "string", description: "Series only, e.g. S02E04." },
      },
      required: titleYearTypeRequired,
    },
  },
  {
    name: "stats",
    description: "Post the speaker's pool stats (!stats).",
    input_schema: { type: "object", properties: {} },
  },
]

// Read-only tools that return information to you without posting anything
export const INFO_TOOLS: Tool[] = [
  {
    name: "find_title",
    description:
      "Find any film or series, in the library or not. Gives year, downloaded and quality, download progress, release dates, whether it can be grabbed yet, ratings, who has it, and if the speaker watched it.",
    input_schema: {
      type: "object",
      properties: {
        title: titleYear.title,
        year: { type: "integer", description: "Optional, narrows it down." },
        type: { type: "string", enum: ["movie", "series"], description: "Optional. Leave out if unsure." },
      },
      required: ["title"],
    },
  },
  {
    name: "browse_library",
    description:
      "List what's downloaded on the server, best for the speaker first, e.g. unseen sci-fi, a franchise or recent arrivals.",
    input_schema: {
      type: "object",
      properties: {
        type: { type: "string", enum: ["movie", "series"] },
        genre: { type: "string", description: "e.g. Science Fiction." },
        keyword: { type: "string", description: "Franchise or title word." },
        recent_days: { type: "integer", description: "Downloaded in the last N days." },
        min_rating: { type: "number", description: "Out of 10." },
        unseen: { type: "boolean", description: "Leave out what the speaker has seen." },
        popular: { type: "boolean", description: "Most watched this month." },
      },
    },
  },
  {
    name: "server_info",
    description:
      "removals: what was deleted lately and why. status: disk space and download queue load.",
    input_schema: {
      type: "object",
      properties: {
        about: { type: "string", enum: ["removals", "status"] },
        title: { type: "string" },
      },
      required: ["about"],
    },
  },
  {
    name: "get_user_profile",
    description:
      "A member's pool, plus taste (top genres, recent Plex watches) unless private. Empty user = the speaker.",
    input_schema: {
      type: "object",
      properties: {
        user: { type: "string", description: "Username, display name or mention." },
      },
    },
  },
]

// Web tools, only offered when an admin has switched on web lookups
export const WEB_TOOLS: Tool[] = [
  {
    name: "web_lookup",
    description:
      "Search film and TV sites for what find_title can't answer: cast, news, box office, streaming. One per message.",
    input_schema: {
      type: "object",
      properties: {
        question: { type: "string", description: "A specific question." },
        title: { type: "string", description: "Optional title it's about." },
        year: { type: "integer", description: "Optional year of that title." },
      },
      required: ["question"],
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
  {
    name: "link_my_plex",
    description:
      "Link the speaker to their own Plex account once they confirm it's theirs.",
    input_schema: {
      type: "object",
      properties: { plex_account: { type: "string", description: "The Plex account name." } },
      required: ["plex_account"],
    },
  },
]

// Plex linking tools only offered to admins when Plex is connected
export const PLEX_ADMIN_TOOLS: Tool[] = [
  {
    name: "propose_plex_links",
    description:
      "Admin only. Guess which Plex account belongs to every Automatarr user and hold the proposal for the admin to confirm.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "confirm_plex_links",
    description:
      "Admin only. Save the pending Plex pairings once the admin confirms, with any corrections they asked for.",
    input_schema: {
      type: "object",
      properties: {
        changes: {
          type: "array",
          description: "Optional corrections. Leave empty to save the proposal as shown.",
          items: {
            type: "object",
            properties: {
              user: { type: "string", description: "The Automatarr user's name, Discord username or display name." },
              plex_account: { type: "string", description: "Their Plex account name, or \"none\" to unlink them." },
            },
            required: ["user", "plex_account"],
          },
        },
      },
    },
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
    name: "forget_fact",
    description: "Forget one remembered fact about the speaker.",
    input_schema: {
      type: "object",
      properties: { fact: { type: "string", description: "As it appears in their profile." } },
      required: ["fact"],
    },
  },
  {
    name: "set_nickname",
    description:
      "Add or remove a nickname. \"them\": what you call the speaker. \"you\": what the speaker calls you, which also gets your attention.",
    input_schema: {
      type: "object",
      properties: {
        for: { type: "string", enum: ["them", "you"] },
        nickname: { type: "string", description: "e.g. Captain or Robo." },
        remove: { type: "boolean", description: "true to remove it." },
      },
      required: ["for", "nickname"],
    },
  },
  {
    name: "set_my_preferences",
    description: "Change the speaker's preferences. Only include what they asked to change.",
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
