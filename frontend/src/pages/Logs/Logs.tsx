import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import moment from "moment"
import { useVirtualizer } from "@tanstack/react-virtual"
import { ArrowDownToLine, Radio, RotateCw } from "lucide-react"
import PageHeader from "../../components/ui/PageHeader/PageHeader"
import Button from "../../components/ui/Button/Button"
import Toggle from "../../components/utility/Toggle/Toggle"
import CenteredLoading from "../../components/utility/CenteredLoading/CenteredLoading"
import { useLogFeed } from "../../shared/hooks/useLogFeed"
import { LogEntry } from "../../types/logType"
import "./_logs.scss"

// A row in the virtual list: the start-of-history note, a date separator or a log entry
type Row =
  | { kind: "start"; key: string }
  | { kind: "day"; key: string; label: string }
  | { kind: "entry"; key: string; entry: LogEntry }

// Pixels from an edge at which the next page starts loading
const EDGE_PX = 480
// Pixels from the bottom that still count as "following" the live tail
const FOLLOW_PX = 48

// Capitalised level name shown beside each line
const levelName = (level: string): string => (level ? level.charAt(0).toUpperCase() + level.slice(1) : "Info")

// Interleave date separators between entries from different days, noting when the oldest kept line is reached
const buildRows = (entries: LogEntry[], atStart: boolean): Row[] => {
  const rows: Row[] = atStart ? [{ kind: "start", key: "start-of-history" }] : []
  let lastDay = ""

  entries.forEach((entry) => {
    const day = moment(entry.timestamp).format("YYYY-MM-DD")
    if (day !== lastDay) {
      rows.push({ kind: "day", key: `day-${day}-${entry.id}`, label: moment(entry.timestamp).format("dddd D MMMM YYYY") })
      lastDay = day
    }
    rows.push({ kind: "entry", key: entry.id, entry })
  })

  return rows
}

// The live log viewer. Scroll up for older lines (across days), down for newer ones; at the bottom it follows new lines live
const Logs: React.FC = () => {
  const feed = useLogFeed()
  const { entries, before, atLiveEdge, status, live, unseen, loadingOlder, loadingNewer, followingRef, loadOlder, loadNewer, reload, markSeen } = feed
  const scrollRef = useRef<HTMLDivElement>(null)
  const anchorRef = useRef<{ key: string; delta: number } | null>(null)
  const [following, setFollowing] = useState(true)
  const [announce, setAnnounce] = useState(false)
  const [announcement, setAnnouncement] = useState("")

  const rows = useMemo(() => buildRows(entries, !before), [entries, before])

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: (i) => (rows[i]?.kind === "entry" ? 30 : 44),
    getItemKey: (i) => rows[i]?.key ?? i,
    overscan: 24,
  })

  // Remember which row is at the top of the view so it stays put when older rows are prepended
  const captureAnchor = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    const first = virtualizer.getVirtualItems().find((item) => item.end > el.scrollTop)
    if (first) anchorRef.current = { key: String(first.key), delta: first.start - el.scrollTop }
  }, [virtualizer])

  // Track whether the viewer is at the bottom, and page in more lines near either edge
  const onScroll = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    const fromBottom = el.scrollHeight - el.scrollTop - el.clientHeight
    const isFollowing = fromBottom < FOLLOW_PX

    followingRef.current = isFollowing
    setFollowing(isFollowing)
    if (isFollowing) markSeen()

    if (el.scrollTop < EDGE_PX && before && !loadingOlder) {
      captureAnchor()
      loadOlder()
    }

    if (fromBottom < EDGE_PX && !atLiveEdge && !loadingNewer) loadNewer()
  }, [before, atLiveEdge, loadingOlder, loadingNewer, loadOlder, loadNewer, captureAnchor, followingRef, markSeen])

  // After rows change: restore the anchor if older rows were prepended, otherwise stick to the bottom when following
  useLayoutEffect(() => {
    const anchor = anchorRef.current

    if (anchor) {
      const index = rows.findIndex((r) => r.key === anchor.key)
      const offset = index >= 0 ? virtualizer.getOffsetForIndex(index, "start")?.[0] : undefined
      if (offset !== undefined) virtualizer.scrollToOffset(offset - anchor.delta)
      anchorRef.current = null
      return
    }

    if (followingRef.current && rows.length > 0) {
      virtualizer.scrollToIndex(rows.length - 1, { align: "end" })
    }
  }, [rows, virtualizer, followingRef])

  // Read the newest line aloud at most every few seconds when announcements are on
  useEffect(() => {
    if (!announce || !following || entries.length === 0) return
    const timer = window.setTimeout(() => {
      const last = entries[entries.length - 1]
      setAnnouncement(`${levelName(last.level)}: ${last.message}`)
    }, 2500)
    return () => window.clearTimeout(timer)
  }, [entries, announce, following])

  // Return to the newest line, reloading the newest page if the window had drifted back in time
  const jumpToLatest = async () => {
    followingRef.current = true
    setFollowing(true)
    markSeen()
    if (!atLiveEdge) await reload()
    else virtualizer.scrollToIndex(rows.length - 1, { align: "end" })
  }

  return (
    <main className="logs-page">
      <PageHeader
        title="Logs"
        description="Everything Automatarr is doing, as it happens. Scroll up to go back through earlier days."
      />

      <div className="logs-toolbar">
        <p className={`logs-live ${live && atLiveEdge ? "is-live" : ""}`}>
          <Radio aria-hidden="true" />
          {live && atLiveEdge ? "Live" : atLiveEdge ? "Connecting…" : "Viewing older lines"}
        </p>
        <div className="logs-toolbar-actions">
          <Toggle name="Read new lines aloud" checked={announce} onToggle={setAnnounce} />
        </div>
      </div>

      {status === "error" ? (
        <div className="page-message" role="alert">
          <h2>Logs couldn't be loaded</h2>
          <p>Automatarr didn't respond, or this address doesn't reach its API. If you use a reverse proxy, make sure it forwards /api as well as /graphql.</p>
          <div className="button-bar">
            <Button variant="secondary" icon={<RotateCw aria-hidden="true" />} onClick={reload}>Try again</Button>
          </div>
        </div>
      ) : status === "loading" ? (
        <CenteredLoading label="Loading logs" />
      ) : (
        <div className="logs-frame">
          <div
            ref={scrollRef}
            className="logs-viewer"
            onScroll={onScroll}
            tabIndex={0}
            role="log"
            aria-live="off"
            aria-label="Log lines, oldest at the top"
          >
            <div className="logs-canvas" style={{ height: virtualizer.getTotalSize() }}>
              {virtualizer.getVirtualItems().map((item) => {
                const row = rows[item.index]
                return (
                  <div
                    key={item.key}
                    ref={virtualizer.measureElement}
                    data-index={item.index}
                    className="logs-row"
                    style={{ transform: `translateY(${item.start}px)` }}
                  >
                    {row.kind === "start" ? (
                      <p className="logs-edge">This is the oldest line still kept. Older logs are cleared after a few days.</p>
                    ) : row.kind === "day" ? (
                      <p className="logs-day">{row.label}</p>
                    ) : (
                      <p className={`logs-line level-${row.entry.level || "info"}`}>
                        <time dateTime={row.entry.timestamp}>{moment(row.entry.timestamp).format("HH:mm:ss")}</time>
                        <span className="logs-level">{levelName(row.entry.level)}</span>
                        <span className="logs-message">{row.entry.message}</span>
                      </p>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {(loadingOlder || loadingNewer) && (
            <p className={`logs-loading ${loadingOlder ? "at-top" : "at-bottom"}`} role="status">
              {loadingOlder ? "Loading older lines…" : "Loading newer lines…"}
            </p>
          )}

          {!following && (
            <Button className="logs-jump" icon={<ArrowDownToLine aria-hidden="true" />} onClick={jumpToLatest}>
              {unseen > 0 ? `Jump to latest (${unseen.toLocaleString()} new)` : "Jump to latest"}
            </Button>
          )}
        </div>
      )}

      <p className="visually-hidden" aria-live="polite">{announcement}</p>
    </main>
  )
}

export default Logs
