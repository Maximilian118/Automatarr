import React, { useEffect, useState } from "react"
import { Button, Chip, IconButton, Typography } from "@mui/material"
import { AutoAwesome, Close } from "@mui/icons-material"
import "./_aiMemories.scss"
import { BotMemory, BotMemoryPreferences } from "../../types/aiType"
import {
  deleteBotMemoryNote,
  forgetBotUser,
  getBotMemories,
  updateBotMemoryPreferences,
} from "../../shared/requests/aiRequests"

// Preference flags shown as clickable chips, with the label shown when each is on
const preferenceChips: { key: keyof BotMemoryPreferences; label: string; inverted?: boolean }[] = [
  { key: "private", label: "Private" },
  { key: "learning", label: "Not learning", inverted: true },
  { key: "chat", label: "Chat muted", inverted: true },
  { key: "recommendations", label: "No recommendations", inverted: true },
]

// Show and manage everything the Claude AI bot remembers about each Discord user
const AIMemories: React.FC = () => {
  const [ memories, setMemories ] = useState<BotMemory[]>([])
  const [ busy, setBusy ] = useState<string | null>(null) // discord_id of the memory being updated

  // Load memories once
  useEffect(() => {
    getBotMemories().then(setMemories).catch(() => setMemories([]))
  }, [])

  // Run a request that returns the updated memory list, tracking which user is busy
  const update = async (discordId: string, request: () => Promise<BotMemory[]>) => {
    setBusy(discordId)
    try {
      setMemories(await request())
    } catch (error) {
      console.error("Failed to update AI memories:", error)
    } finally {
      setBusy(null)
    }
  }

  if (memories.length === 0) return null

  return (
    <section className="ai-memories">
      <div className="ai-memories-header">
        <AutoAwesome/>
        <h2>What Automatarr Remembers</h2>
      </div>
      <p className="ai-memories-description">
        Facts the Claude AI bot has learnt about people and their preferences. Click a preference to toggle it.
      </p>
      <div className="ai-memories-grid">
        {memories.map(memory => (
          <div key={memory.discord_id} className="ai-memory-card">
            <div className="ai-memory-card-top">
              <h3>{memory.username}</h3>
              <Button
                size="small"
                color="error"
                disabled={busy === memory.discord_id}
                onClick={() => update(memory.discord_id, () => forgetBotUser(memory.discord_id))}
              >
                Forget
              </Button>
            </div>
            <div className="ai-memory-chips">
              {preferenceChips.map(({ key, label, inverted }) => {
                const value = memory.preferences[key]
                const flagged = inverted ? !value : value

                return (
                  <Chip
                    key={key}
                    label={label}
                    size="small"
                    color={flagged ? "warning" : "default"}
                    variant={flagged ? "filled" : "outlined"}
                    disabled={busy === memory.discord_id}
                    onClick={() => update(memory.discord_id, () =>
                      updateBotMemoryPreferences(memory.discord_id, { [key]: !value }),
                    )}
                  />
                )
              })}
            </div>
            {memory.notes.length === 0 ? (
              <Typography variant="body2" className="ai-memory-empty">Nothing remembered yet</Typography>
            ) : (
              <ul className="ai-memory-notes">
                {memory.notes.map((note, index) => (
                  <li key={`${memory.discord_id}-${index}`}>
                    <span>{note.text}</span>
                    <IconButton
                      size="small"
                      disabled={busy === memory.discord_id}
                      onClick={() => update(memory.discord_id, () => deleteBotMemoryNote(memory.discord_id, index))}
                    >
                      <Close fontSize="small"/>
                    </IconButton>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>
    </section>
  )
}

export default AIMemories
