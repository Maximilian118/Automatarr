import logger from "../../../logger"
import { randomInCharacterDeflection } from "../discordBotRandomReply"

// Hard ceiling for a single AI reply so the channel never gets clogged
export const MAX_REPLY_LENGTH = 500

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

// Trim a reply to the length cap, cutting at the last sentence boundary where possible
const trimToLength = (text: string): string => {
  if (text.length <= MAX_REPLY_LENGTH) return text

  const clipped = text.slice(0, MAX_REPLY_LENGTH)
  const lastStop = Math.max(clipped.lastIndexOf(". "), clipped.lastIndexOf("! "), clipped.lastIndexOf("? "))

  return lastStop > MAX_REPLY_LENGTH / 2 ? clipped.slice(0, lastStop + 1) : `${clipped.trimEnd()}…`
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
