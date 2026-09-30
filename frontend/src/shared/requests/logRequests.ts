import axios from "axios"
import { fetchEventSource } from "@microsoft/fetch-event-source"
import { getApiBaseUrl } from "../../utils/apiConfig"
import { LogEntry, LogPage } from "../../types/logType"
import { handleResponseTokens, headers } from "./requestUtility"
import { AuthHandlers } from "./graphqlRequest"

// Headers built fresh from storage each time, so refreshed tokens are always used
const authHeaders = (): Record<string, string> => {
  const { accessToken, refreshToken } = headers(localStorage.getItem("access_token") || "")
  return { accessToken, refreshToken }
}

// Fetch a page of log entries: the newest page, or the page before/after a cursor
export const fetchLogPage = async (
  params: { before?: string; after?: string; limit?: number },
  auth: AuthHandlers,
): Promise<LogPage> => {
  const res = await axios.get<LogPage>("/api/logs", {
    baseURL: getApiBaseUrl(),
    params,
    headers: authHeaders(),
  })
  handleResponseTokens(res.data, auth.setUser)
  return res.data
}

interface StreamHandlers {
  onEntry: (entry: LogEntry) => void
  onStatus: (live: boolean) => void
}

const RETRY_MS = 3000

// Follow new log entries from a cursor. Reconnects with fresh tokens and resumes after the last entry seen.
// Returns a function that stops the stream
export const followLogs = (from: string, handlers: StreamHandlers, auth: AuthHandlers): (() => void) => {
  const controller = new AbortController()
  let lastId: string | null = null
  let retryTimer: number | undefined
  let unauthorised = false

  // Open (or reopen) the stream
  const connect = () => {
    if (controller.signal.aborted) return

    const attempt = new AbortController()
    controller.signal.addEventListener("abort", () => attempt.abort(), { once: true })

    const url = `${getApiBaseUrl()}/api/logs/stream?from=${encodeURIComponent(from)}`
    const requestHeaders: Record<string, string> = authHeaders()
    if (lastId) requestHeaders["Last-Event-ID"] = lastId

    fetchEventSource(url, {
      signal: attempt.signal,
      headers: requestHeaders,
      openWhenHidden: true,
      async onopen(response) {
        // A rejected login won't fix itself by retrying
        if (response.status === 401) unauthorised = true
        if (!response.ok) throw new Error(`Log stream refused: ${response.status}`)
        handlers.onStatus(true)
      },
      onmessage(event) {
        if (event.event === "tokens") {
          try {
            handleResponseTokens({ tokens: JSON.parse(event.data) as string[] }, auth.setUser)
          } catch {
            // Malformed token event: keep the current tokens
          }
          return
        }

        if (!event.data) return
        try {
          const entry = JSON.parse(event.data) as LogEntry
          lastId = entry.id
          handlers.onEntry(entry)
        } catch {
          // Skip anything that isn't a log entry
        }
      },
      onclose() {
        // The server closed the stream; treat it like an error so we reconnect
        throw new Error("Log stream closed")
      },
      onerror(err) {
        // Stop the library's own retry (it would reuse stale headers) and reconnect ourselves
        throw err
      },
    }).catch(() => {
      if (controller.signal.aborted) return
      handlers.onStatus(false)
      attempt.abort()
      if (!unauthorised) retryTimer = window.setTimeout(connect, RETRY_MS)
    })
  }

  connect()

  return () => {
    window.clearTimeout(retryTimer)
    controller.abort()
    handlers.onStatus(false)
  }
}
