import { Message } from "discord.js"
import { findMemory, updatePreferences } from "../ai/aiMemory"

// What being private hides, in one line for replies
const PRIVATE_MEANS =
  "Your Plex watch history and taste are kept out of public replies like `!list`, `!stats` and `!search`, and out of anyone else's popularity counts."

// Turn privacy on or off for the author, or show their current setting. Works with or without the AI.
// Usage: !private <on|off>
export const casePrivate = async (message: Message): Promise<string> => {
  const [, choice] = message.content.trim().split(/\s+/)
  const identity = { id: message.author.id, username: message.author.username }

  if (!choice) {
    const isPrivate = !!(await findMemory(identity.id))?.preferences.private
    return isPrivate
      ? `You're private. ${PRIVATE_MEANS} Use \`!private off\` to share them again.`
      : "You're not private, so your Plex watch history can show in replies like `!list`. Use `!private on` to hide it."
  }

  const value = choice.toLowerCase()
  if (value !== "on" && value !== "off") return "Usage: `!private on` or `!private off`."

  await updatePreferences(identity, { private: value === "on" })

  return value === "on"
    ? `Done, you're private now. ${PRIVATE_MEANS}`
    : "Done, you're no longer private. Your Plex watch history can show in replies like `!list` again."
}
