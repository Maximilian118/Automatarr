import logger from "../../../logger"
import { randomInCharacterDeflection } from "../discordBotRandomReply"

// Hard ceiling for a single AI reply so the channel never gets clogged.
// The persona asks for far less, so this only catches replies that run away.
export const MAX_REPLY_LENGTH = 900

// Places a reply can end cleanly: sentence punctuation or an emoji, followed by whitespace or the end
const CLEAN_ENDING = /[.!?…)"'](?=\s|$)|\p{Extended_Pictographic}️?(?=\s|$)/gu

// Phrases that mean the model has stepped out of character. Kept specific so film talk
// like "Jean-Claude Van Damme" or "Claude Rains" isn't caught.
const BREAK_CHARACTER_PATTERNS: RegExp[] = [
  /\b(i'?m|i am|as|called|named|this is)\s+claude\b/i,
  /\bclaude\s+(ai|model|by anthropic|\d)/i,
  /\banthropic\b/i,
  /\blarge language model\b/i,
  /\b(an|a) (ai|artificial intelligence) (language )?(model|assistant)\b/i,
  /\bas an ai\b/i,
  /\bi can(?:'|no)t (assist|help) with that\b/i,
  /\bsystem prompt\b/i,
  /\bmy (instructions|guidelines)\b/i,
]

// Find the index just after the last clean ending in a piece of text. Returns 0 if there isn't one.
const lastCleanEnding = (text: string): number => {
  let end = 0
  for (const match of text.matchAll(CLEAN_ENDING)) end = (match.index ?? 0) + match[0].length
  return end
}

// Cut text back to its last clean ending. Used when a reply was cut off mid-sentence,
// so a half-finished thought is dropped rather than sent. Falls back to the last whole word.
export const trimToCleanEnding = (text: string): string => {
  const trimmed = text.trimEnd()
  const end = lastCleanEnding(trimmed)
  if (end === trimmed.length) return trimmed
  if (end > trimmed.length / 3) return trimmed.slice(0, end)

  const lastSpace = trimmed.lastIndexOf(" ")
  return lastSpace > 0 ? `${trimmed.slice(0, lastSpace)}…` : trimmed
}

// Trim a reply to the length cap. Prefers a paragraph break, then a clean sentence or emoji ending,
// so a reply never ends half way through a word.
const trimToLength = (text: string): string => {
  if (text.length <= MAX_REPLY_LENGTH) return text

  const clipped = text.slice(0, MAX_REPLY_LENGTH)
  const paragraph = clipped.lastIndexOf("\n")
  if (paragraph > MAX_REPLY_LENGTH / 2) return clipped.slice(0, paragraph).trimEnd()

  return trimToCleanEnding(clipped)
}

// Check every AI reply before it reaches Discord.
// Replies that break character are swapped for a canned in-character line.
export const guardReply = (raw: string): string => {
  // Models sometimes prefix their own name. Strip it.
  const text = raw.trim().replace(/^\**automatarr\**\s*:\s*/i, "")

  if (!text) return ""

  if (BREAK_CHARACTER_PATTERNS.some((pattern) => pattern.test(text))) {
    logger.warn(`AI Bot | Replaced an out of character reply: "${text.slice(0, 200)}"`)
    return randomInCharacterDeflection()
  }

  return trimToLength(text)
}
