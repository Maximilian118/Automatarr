// In-memory record of each user's recent exchange with Automatarr.
// Scoped per channel and per user so the AI only ever sees a speaker's own conversation
// with the bot, never bystanders' chatter. Nothing here is persisted.

export type ExchangeEntry = {
  role: "user" | "bot"
  text: string
  at: number // Epoch milliseconds
}

type Exchange = {
  entries: ExchangeEntry[]
  lastBotReplyAt: number // When the bot last replied to this user in this channel. 0 = never
  interrupted: boolean // Whether someone else has spoken in the channel since the bot's last reply
}

// How long a conversation stays active after the bot's last reply once other people are chatting
export const CONVERSATION_WINDOW_MS = 5 * 60 * 1000

// How long a conversation stays active while nobody else has spoken since the bot's last reply.
// The user still "has the floor", so their next message is almost certainly for the bot.
export const FLOOR_WINDOW_MS = 20 * 60 * 1000

// How many entries are kept per exchange. Roughly the last 8 turns.
const MAX_ENTRIES = 16

// Exchanges idle for longer than this are discarded entirely
const PRUNE_AFTER_MS = 30 * 60 * 1000

// Longest text stored per entry. Keeps the context cheap.
const MAX_ENTRY_LENGTH = 400

const exchanges = new Map<string, Exchange>()

// Things that happened for a user outside the chat, like a download finishing or command output
// posted in another channel. Keyed by user only, so the bot knows about them wherever they chat next.
type UserEvent = { text: string; at: number }

// How many events are kept per user, and for how long
const MAX_EVENTS = 5
const EVENT_WINDOW_MS = 12 * 60 * 60 * 1000

const userEvents = new Map<string, UserEvent[]>()

// A user's own recent messages that the bot didn't respond to. If they then address the bot,
// these give it the lead-up, e.g. a nickname it didn't recognise yet. Held briefly, never persisted.
type Aside = { text: string; at: number }

// How many unanswered messages are kept per user per channel, and for how long
const MAX_ASIDES = 3
const ASIDE_WINDOW_MS = 10 * 60 * 1000

const asides = new Map<string, Aside[]>()

// Build the map key for a user in a channel
const exchangeKey = (channelId: string, userId: string): string => `${channelId}:${userId}`

// Discard exchanges nobody has touched for a while, and asides that have gone stale
const pruneExchanges = (): void => {
  const cutoff = Date.now() - PRUNE_AFTER_MS

  exchanges.forEach((exchange, key) => {
    const last = exchange.entries[exchange.entries.length - 1]
    if (!last || last.at < cutoff) exchanges.delete(key)
  })

  const asideCutoff = Date.now() - ASIDE_WINDOW_MS
  asides.forEach((list, key) => {
    if (!list.some((a) => a.at > asideCutoff)) asides.delete(key)
  })
}

// Get or create the exchange for a user in a channel
const getExchange = (channelId: string, userId: string): Exchange => {
  const key = exchangeKey(channelId, userId)
  let exchange = exchanges.get(key)

  if (!exchange) {
    exchange = { entries: [], lastBotReplyAt: 0, interrupted: false }
    exchanges.set(key, exchange)
  }

  return exchange
}

// Append an entry to an exchange, keeping it within size limits
const pushEntry = (exchange: Exchange, entry: ExchangeEntry): void => {
  exchange.entries.push({ ...entry, text: entry.text.slice(0, MAX_ENTRY_LENGTH) })
  if (exchange.entries.length > MAX_ENTRIES) exchange.entries.splice(0, exchange.entries.length - MAX_ENTRIES)
}

// Record something a user said to Automatarr, including ! commands
export const recordUserMessage = (channelId: string, userId: string, text: string): void => {
  pruneExchanges()
  pushEntry(getExchange(channelId, userId), { role: "user", text, at: Date.now() })
}

// Record a reply Automatarr sent to a user. This starts or extends a conversation.
export const recordBotReply = (channelId: string, userId: string, text: string): void => {
  const exchange = getExchange(channelId, userId)
  pushEntry(exchange, { role: "bot", text, at: Date.now() })
  exchange.lastBotReplyAt = Date.now()
  exchange.interrupted = false
}

// Note that a human posted in a channel. Anyone else talking with the bot there loses the floor.
export const noteChannelMessage = (channelId: string, authorId: string): void => {
  exchanges.forEach((exchange, key) => {
    if (key.startsWith(`${channelId}:`) && key !== exchangeKey(channelId, authorId) && exchange.lastBotReplyAt) {
      exchange.interrupted = true
    }
  })
}

// Check whether a user is in an active conversation with Automatarr in a channel.
// The window is longer while nobody else has spoken since the bot's last reply.
export const inConversation = (channelId: string, userId: string): boolean => {
  const exchange = exchanges.get(exchangeKey(channelId, userId))
  if (!exchange || !exchange.lastBotReplyAt) return false

  const windowMs = exchange.interrupted ? CONVERSATION_WINDOW_MS : FLOOR_WINDOW_MS
  return Date.now() - exchange.lastBotReplyAt < windowMs
}

// End a conversation, e.g. when the user turns to talk to someone else
export const endConversation = (channelId: string, userId: string): void => {
  const exchange = exchanges.get(exchangeKey(channelId, userId))
  if (exchange) exchange.lastBotReplyAt = 0
}

// Note something that happened for a user outside their chat with the bot
export const recordUserEvent = (userId: string, text: string): void => {
  const cutoff = Date.now() - EVENT_WINDOW_MS
  const list = (userEvents.get(userId) ?? []).filter((e) => e.at > cutoff)

  list.push({ text: text.slice(0, MAX_ENTRY_LENGTH), at: Date.now() })
  userEvents.set(userId, list.slice(-MAX_EVENTS))
}

// Get a user's recent events, oldest first, with how long ago each happened
export const getUserEvents = (userId: string): { text: string; at: number }[] => {
  const cutoff = Date.now() - EVENT_WINDOW_MS
  return (userEvents.get(userId) ?? []).filter((e) => e.at > cutoff)
}

// Note a message from a user that the bot didn't respond to
export const recordAside = (channelId: string, userId: string, text: string): void => {
  pruneExchanges()

  const key = exchangeKey(channelId, userId)
  const list = [...(asides.get(key) ?? []), { text: text.slice(0, MAX_ENTRY_LENGTH), at: Date.now() }]
  asides.set(key, list.slice(-MAX_ASIDES))
}

// Get a user's recent unanswered messages in a channel, oldest first
export const getAsides = (channelId: string, userId: string): string[] => {
  const cutoff = Date.now() - ASIDE_WINDOW_MS
  return (asides.get(exchangeKey(channelId, userId)) ?? []).filter((a) => a.at > cutoff).map((a) => a.text)
}

// Clear a user's unanswered messages once the bot has replied, so they aren't shown twice
export const clearAsides = (channelId: string, userId: string): void => {
  asides.delete(exchangeKey(channelId, userId))
}

// Get a user's recent exchange with Automatarr in a channel, oldest first
export const getExchangeEntries = (channelId: string, userId: string): ExchangeEntry[] =>
  exchanges.get(exchangeKey(channelId, userId))?.entries ?? []
