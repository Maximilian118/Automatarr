import { MutableRefObject, useCallback, useEffect, useRef, useState } from "react"
import { LogEntry } from "../../types/logType"
import { fetchLogPage, followLogs } from "../requests/logRequests"
import { useAuthHandlers } from "./useAuthHandlers"

const PAGE_SIZE = 200
const MAX_ENTRIES = 3000

interface FeedWindow {
  entries: LogEntry[]
  before: string | null // Cursor for older entries; null when the oldest log line is loaded
  after: string // Cursor for newer entries when the window doesn't reach the newest line
  atLiveEdge: boolean // Whether the newest loaded entry is the newest line in the logs
}

export interface LogFeed extends FeedWindow {
  status: "loading" | "ready" | "error"
  live: boolean
  unseen: number
  loadingOlder: boolean
  loadingNewer: boolean
  followingRef: MutableRefObject<boolean>
  loadOlder: () => Promise<void>
  loadNewer: () => Promise<void>
  reload: () => Promise<void>
  markSeen: () => void
}

const emptyWindow: FeedWindow = { entries: [], before: null, after: "", atLiveEdge: true }

// A sliding window over the log files. Scrolling up pages older entries in, scrolling down pages newer ones,
// and at the newest edge a live stream appends entries as they are written.
// At most MAX_ENTRIES are kept; the far end is dropped and re-fetched if the viewer scrolls back to it
export const useLogFeed = (): LogFeed => {
  const auth = useAuthHandlers()
  const [feed, setFeed] = useState<FeedWindow>(emptyWindow)
  const [status, setStatus] = useState<LogFeed["status"]>("loading")
  const [live, setLive] = useState(false)
  const [unseen, setUnseen] = useState(0)
  const [streamFrom, setStreamFrom] = useState<string | null>(null)
  const [loadingOlder, setLoadingOlder] = useState(false)
  const [loadingNewer, setLoadingNewer] = useState(false)
  const feedRef = useRef(feed)
  const busy = useRef({ older: false, newer: false })
  const followingRef = useRef(true)

  feedRef.current = feed

  // Load the newest page and start following from its end
  const reload = useCallback(async () => {
    setStatus((s) => (s === "ready" ? s : "loading"))
    setStreamFrom(null)

    try {
      const page = await fetchLogPage({ limit: PAGE_SIZE }, auth)
      setFeed({ entries: page.entries, before: page.before, after: page.after, atLiveEdge: true })
      setStreamFrom(page.after)
      setUnseen(0)
      setStatus("ready")
    } catch {
      setStatus("error")
    }
  }, [auth])

  // Initial load
  useEffect(() => {
    reload()
  }, [reload])

  // Page in older entries above the window, dropping the newest ones past the cap
  const loadOlder = useCallback(async () => {
    const current = feedRef.current
    if (busy.current.older || !current.before) return
    busy.current.older = true
    setLoadingOlder(true)

    try {
      const page = await fetchLogPage({ before: current.before, limit: PAGE_SIZE }, auth)

      setFeed((prev) => {
        const combined = [...page.entries, ...prev.entries]
        if (combined.length <= MAX_ENTRIES) return { ...prev, entries: combined, before: page.before }

        // Drop the newest entries; paging forward from the first dropped one brings them back
        const dropped = combined.slice(MAX_ENTRIES)
        return { entries: combined.slice(0, MAX_ENTRIES), before: page.before, after: dropped[0].id, atLiveEdge: false }
      })

      if (feedRef.current.entries.length + page.entries.length > MAX_ENTRIES) setStreamFrom(null)
    } catch {
      // Leave the window as it is; scrolling again retries
    } finally {
      busy.current.older = false
      setLoadingOlder(false)
    }
  }, [auth])

  // Page in newer entries below the window, re-joining the live stream once the newest line is reached
  const loadNewer = useCallback(async () => {
    const current = feedRef.current
    if (busy.current.newer || current.atLiveEdge) return
    busy.current.newer = true
    setLoadingNewer(true)

    try {
      const page = await fetchLogPage({ after: current.after, limit: PAGE_SIZE }, auth)
      const reachedEdge = page.entries.length < PAGE_SIZE

      setFeed((prev) => {
        const combined = [...prev.entries, ...page.entries]
        const kept = combined.length > MAX_ENTRIES ? combined.slice(combined.length - MAX_ENTRIES) : combined
        return {
          entries: kept,
          before: kept.length < combined.length ? kept[0].id : prev.before,
          after: page.after,
          atLiveEdge: reachedEdge,
        }
      })

      if (reachedEdge) setStreamFrom(page.after)
    } catch {
      // Leave the window as it is; scrolling again retries
    } finally {
      busy.current.newer = false
      setLoadingNewer(false)
    }
  }, [auth])

  // Follow the live stream while the window reaches the newest line
  useEffect(() => {
    if (!streamFrom) return

    const stop = followLogs(
      streamFrom,
      {
        onStatus: setLive,
        onEntry: (entry) => {
          const current = feedRef.current

          // Scrolled far back with a full window: stop following rather than drop what's being read
          if (current.entries.length >= MAX_ENTRIES && !followingRef.current) {
            setFeed((prev) => ({ ...prev, after: entry.id, atLiveEdge: false }))
            setStreamFrom(null)
            return
          }

          setFeed((prev) => {
            if (prev.entries[prev.entries.length - 1]?.id === entry.id) return prev
            const combined = [...prev.entries, entry]
            const kept = combined.length > MAX_ENTRIES ? combined.slice(combined.length - MAX_ENTRIES) : combined
            return { ...prev, entries: kept, before: kept.length < combined.length ? kept[0].id : prev.before }
          })

          if (!followingRef.current) setUnseen((n) => n + 1)
        },
      },
      auth,
    )

    return stop
  }, [streamFrom, auth])

  // Clear the "new lines" count once the viewer is back at the bottom
  const markSeen = useCallback(() => setUnseen(0), [])

  return { ...feed, status, live, unseen, loadingOlder, loadingNewer, followingRef, loadOlder, loadNewer, reload, markSeen }
}
