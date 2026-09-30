import React, { useEffect, useState } from "react"
import { Check, Sparkles, Trash2, X } from "lucide-react"
import "./_aiMemories.scss"
import { BotMemory, BotMemoryPreferences } from "../../types/aiType"
import {
  deleteBotMemoryNote,
  forgetBotUser,
  getBotMemories,
  updateBotMemoryPreferences,
} from "../../shared/requests/aiRequests"
import ConfirmButton from "../ui/ConfirmButton/ConfirmButton"
import { useToast } from "../../shared/toast/useToast"

// Preference flags shown as toggle buttons, with the label describing the flag when it is on
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
  const [ pendingNote, setPendingNote ] = useState<string | null>(null) // "<discord_id>-<index>" awaiting delete confirmation
  const { showToast } = useToast()

  // Load memories once
  useEffect(() => {
    getBotMemories().then(setMemories).catch(() => setMemories([]))
  }, [])

  // Run a request that returns the updated memory list, tracking which user is busy
  const update = async (discordId: string, request: () => Promise<BotMemory[]>, failure: string) => {
    setBusy(discordId)
    try {
      setMemories(await request())
    } catch (error) {
      console.error("Failed to update AI memories:", error)
      showToast({ tone: "error", title: failure, message: "Nothing was changed. Try again." })
    } finally {
      setBusy(null)
      setPendingNote(null)
    }
  }

  if (memories.length === 0) return null

  return (
    <section className="ai-memories" aria-labelledby="ai-memories-title">
      <div className="ai-memories-header">
        <Sparkles aria-hidden="true"/>
        <h2 id="ai-memories-title">What Automatarr remembers</h2>
      </div>
      <p className="ai-memories-description">
        Facts the Claude assistant has learnt about people, and each person's privacy choices. Press a preference to switch it.
      </p>
      <ul className="ai-memories-grid">
        {memories.map(memory => (
          <li key={memory.discord_id} className="ai-memory-card">
            <h3>{memory.username}</h3>
            <div className="ai-memory-chips" role="group" aria-label={`${memory.username}'s preferences`}>
              {preferenceChips.map(({ key, label, inverted }) => {
                const value = memory.preferences[key]
                const flagged = inverted ? !value : value

                return (
                  <button
                    type="button"
                    key={key}
                    className="ai-memory-chip"
                    aria-pressed={flagged}
                    disabled={busy === memory.discord_id}
                    onClick={() => update(
                      memory.discord_id,
                      () => updateBotMemoryPreferences(memory.discord_id, { [key]: !value }),
                      `Couldn't change ${memory.username}'s preferences`,
                    )}
                  >
                    {flagged && <Check aria-hidden="true" />}
                    {label}
                  </button>
                )
              })}
            </div>
            {memory.notes.length === 0 ? (
              <p className="ai-memory-empty">Nothing remembered yet.</p>
            ) : (
              <ul className="ai-memory-notes" aria-label={`Notes about ${memory.username}`}>
                {memory.notes.map((note, index) => {
                  const noteKey = `${memory.discord_id}-${index}`
                  const confirming = pendingNote === noteKey

                  return (
                    <li key={noteKey}>
                      <span>{note.text}</span>
                      {confirming ? (
                        <span className="ai-memory-note-confirm" role="group" aria-label="Delete this note?">
                          <button
                            type="button"
                            className="ai-memory-text-button ai-memory-danger"
                            disabled={busy === memory.discord_id}
                            onClick={() => update(
                              memory.discord_id,
                              () => deleteBotMemoryNote(memory.discord_id, index),
                              "Couldn't delete the note",
                            )}
                          >
                            Delete
                          </button>
                          <button type="button" className="ai-memory-text-button" onClick={() => setPendingNote(null)} autoFocus>
                            Keep
                          </button>
                        </span>
                      ) : (
                        <button
                          type="button"
                          className="ai-memory-icon-button"
                          disabled={busy === memory.discord_id}
                          onClick={() => setPendingNote(noteKey)}
                        >
                          <X aria-hidden="true"/>
                          <span className="visually-hidden">Delete note: {note.text}</span>
                        </button>
                      )}
                    </li>
                  )
                })}
              </ul>
            )}
            <div className="ai-memory-forget">
              <ConfirmButton
                label="Forget"
                confirmLabel={`Forget ${memory.username}`}
                question={`Forget everything about ${memory.username}? Their notes and request history are wiped; their preferences stay.`}
                icon={<Trash2 aria-hidden="true"/>}
                loading={busy === memory.discord_id}
                onConfirm={() => update(memory.discord_id, () => forgetBotUser(memory.discord_id), `Couldn't forget ${memory.username}`)}
              />
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}

export default AIMemories
