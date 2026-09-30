import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"
import moment from "moment"
import { ChevronDown } from "lucide-react"
import Footer from "../../components/footer/Footer"
import PageHeader from "../../components/ui/PageHeader/PageHeader"
import Button from "../../components/ui/Button/Button"
import CenteredLoading from "../../components/utility/CenteredLoading/CenteredLoading"
import { getActivity } from "../../shared/requests/dashboardRequests"
import { useAuthHandlers } from "../../shared/hooks/useAuthHandlers"
import { ActivityItem, ActivitySource } from "../../types/activityType"
import { actionIcons, describeAction, sourceLabel } from "../../shared/activityLabels"
import { formatFull, formatSize } from "../../shared/format"
import "./_activity.scss"

const PAGE_SIZE = 50

// "Today", "Yesterday", or a full date heading for a group of removals
const dayHeading = (iso: string): string => {
  const m = moment(iso)
  if (m.isSame(moment(), "day")) return "Today"
  if (m.isSame(moment().subtract(1, "day"), "day")) return "Yesterday"
  return m.format("dddd D MMMM")
}

// A record of everything Automatarr removed, newest first, loading more as you reach the end
const Activity: React.FC = () => {
  const auth = useAuthHandlers()
  const [items, setItems] = useState<ActivityItem[]>([])
  const [sources, setSources] = useState<ActivitySource[]>([])
  const [next, setNext] = useState<string | null>(null)
  const [source, setSource] = useState<string | null>(null)
  const [loading, setLoading] = useState<boolean>(true)
  const [failed, setFailed] = useState<boolean>(false)
  const sentinelRef = useRef<HTMLDivElement>(null)
  const loadingMore = useRef(false)
  const requestId = useRef(0)

  // Load a page. A null cursor starts over (used when the filter changes) and wins over any
  // request still in flight; older pages load one at a time
  const load = useCallback(
    async (before: string | null) => {
      if (before && loadingMore.current) return
      loadingMore.current = !!before
      const id = ++requestId.current
      setLoading(true)

      try {
        const page = await getActivity({ before, limit: PAGE_SIZE, source }, auth)
        if (id !== requestId.current) return
        setItems((prev) => (before ? [...prev, ...page.items] : page.items))
        setNext(page.next)
        setSources(page.sources)
        setFailed(false)
      } catch {
        if (id === requestId.current) setFailed(true)
      } finally {
        if (id === requestId.current) {
          loadingMore.current = false
          setLoading(false)
        }
      }
    },
    [auth, source],
  )

  // Start over whenever the source filter changes
  useEffect(() => {
    load(null)
  }, [load])

  // Load the next page when the end of the list scrolls into view
  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel || !next) return

    const observer = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting) load(next)
    }, { rootMargin: "400px" })

    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [next, load])

  // Group removals under a heading per day
  const groups = useMemo(() => {
    const byDay = new Map<string, ActivityItem[]>()
    items.forEach((item) => {
      const key = moment(item.at).format("YYYY-MM-DD")
      const bucket = byDay.get(key)
      if (bucket) bucket.push(item)
      else byDay.set(key, [item])
    })
    return Array.from(byDay.entries())
  }, [items])

  const total = sources.reduce((sum, s) => sum + s.count, 0)

  return (
    <main className="activity-page">
      <PageHeader
        title="Activity"
        description="Everything Automatarr has removed in the last 90 days, newest first, and which loop or command removed it."
      />

      {sources.length > 0 && (
        <div className="activity-filter" role="group" aria-label="Show removals from">
          <button type="button" className="activity-filter-option" aria-pressed={source === null} onClick={() => setSource(null)}>
            Everything <span>{total.toLocaleString()}</span>
          </button>
          {sources.map((s) => (
            <button
              type="button"
              key={s.source}
              className="activity-filter-option"
              aria-pressed={source === s.source}
              onClick={() => setSource(s.source)}
            >
              {sourceLabel(s.source)} <span>{s.count.toLocaleString()}</span>
            </button>
          ))}
        </div>
      )}

      {failed && items.length === 0 ? (
        <div className="page-message" role="alert">
          <h2>Activity couldn't be loaded</h2>
          <p>Automatarr didn't respond. Check it's running, then reload this page.</p>
        </div>
      ) : loading && items.length === 0 ? (
        <CenteredLoading label="Loading activity" />
      ) : items.length === 0 ? (
        <div className="page-message">
          <h2>Nothing removed yet</h2>
          <p>When a loop or a Discord command removes something, it's listed here with the reason and how much space it freed.</p>
        </div>
      ) : (
        <div className="activity-feed">
          {groups.map(([day, dayItems]) => (
            <section key={day} className="activity-day" aria-labelledby={`activity-${day}`}>
              <h2 id={`activity-${day}`} className="activity-day-heading">{dayHeading(dayItems[0].at)}</h2>
              <ol className="activity-list">
                {dayItems.map((item) => {
                  const Icon = actionIcons[item.action] ?? actionIcons.file
                  return (
                    <li key={item._id} className={`activity-item action-${item.action}`}>
                      <span className="activity-icon" aria-hidden="true"><Icon /></span>
                      <div className="activity-body">
                        <p className="activity-title">{item.title}</p>
                        <p className="activity-what">
                          {describeAction(item)}
                          {item.bytes ? `, ${formatSize(item.bytes)} freed` : ""}
                        </p>
                        {item.reason && <p className="activity-reason">Why: {item.reason}</p>}
                        {item.path && <p className="activity-path">{item.path}</p>}
                      </div>
                      <div className="activity-meta">
                        <time dateTime={item.at} title={formatFull(item.at)}>{moment(item.at).format("HH:mm")}</time>
                        <span className="activity-source">{sourceLabel(item.source)}</span>
                      </div>
                    </li>
                  )
                })}
              </ol>
            </section>
          ))}

          <div ref={sentinelRef} className="activity-more">
            {next ? (
              <Button variant="secondary" loading={loading} icon={<ChevronDown aria-hidden="true" />} onClick={() => load(next)}>
                Load older activity
              </Button>
            ) : (
              <p>That's everything from the last 90 days.</p>
            )}
          </div>
        </div>
      )}

      <Footer />
    </main>
  )
}

export default Activity
