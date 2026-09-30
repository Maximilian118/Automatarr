import React, { useContext, useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import { HardDrive } from "lucide-react"
import AppContext from "../../context"
import { BotUserType } from "../../types/settingsType"
import { StatsType } from "../../types/statsType"
import { getStats } from "../../shared/requests/statsRequests"
import { calculateUserTotalStorageBytes } from "../../shared/userUtility"
import { formatSize } from "../../shared/format"
import "./_poolStorage.scss"

interface PoolStorageProps {
  users: BotUserType[]
}

interface Share {
  key: string
  label: string
  bytes: number
}

// How the drive is split between user pools, other library content and free space,
// followed by each person's share ranked from largest to smallest
const PoolStorage: React.FC<PoolStorageProps> = ({ users }) => {
  const { user, setUser, setLoading } = useContext(AppContext)
  const [stats, setStats] = useState<StatsType | null>(null)
  const navigate = useNavigate()

  // Fetch the latest storage figures once the user is known
  useEffect(() => {
    if (!user.token) return
    getStats(setStats, user, setUser, setLoading, navigate).catch((error) =>
      console.error("Failed to fetch stats for pool storage:", error),
    )
  }, [user, setUser, setLoading, navigate])

  const { people, split, total, emptyCount } = useMemo(() => {
    const latest = stats?.data_points?.[stats.data_points.length - 1]
    const totalBytes = Number(latest?.storage.total_storage_size || 0)
    const freeBytes = Number(latest?.storage.free_storage || 0)

    const ranked = users
      .map((u) => ({ name: u.name, bytes: calculateUserTotalStorageBytes(u) }))
      .sort((a, b) => b.bytes - a.bytes)
    const keeping = ranked.filter((p) => p.bytes > 0)
    const poolBytes = keeping.reduce((sum, p) => sum + p.bytes, 0)
    const otherBytes = Math.max(totalBytes - freeBytes - poolBytes, 0)

    const shares: Share[] = [
      { key: "pools", label: "Kept in pools", bytes: poolBytes },
      { key: "other", label: "Other library content", bytes: otherBytes },
      { key: "free", label: "Free", bytes: freeBytes },
    ]

    return { people: keeping, split: shares, total: totalBytes, emptyCount: ranked.length - keeping.length }
  }, [users, stats])

  const largest = people[0]?.bytes || 1

  return (
    <section className="pool-storage" aria-labelledby="pool-storage-title">
      <div className="pool-storage-heading">
        <HardDrive aria-hidden="true" />
        <h2 id="pool-storage-title">Storage by person</h2>
      </div>

      {total > 0 && (
        <>
          {/* One bar for the whole drive. Segments are separated by gaps and each is named below */}
          <div className="pool-storage-split" aria-hidden="true">
            {split.filter((s) => s.bytes > 0).map((s) => (
              <span key={s.key} className={`pool-storage-segment segment-${s.key}`} style={{ flexGrow: s.bytes }} />
            ))}
          </div>
          <dl className="pool-storage-legend">
            {split.map((s) => (
              <div key={s.key}>
                <dt><span className={`pool-storage-swatch segment-${s.key}`} aria-hidden="true" />{s.label}</dt>
                <dd>{formatSize(s.bytes)} <span className="pool-storage-share">({Math.round((s.bytes / total) * 100)}%)</span></dd>
              </div>
            ))}
          </dl>
        </>
      )}

      {people.length === 0 ? (
        <p className="pool-storage-empty">Nobody is keeping anything in their pool yet.</p>
      ) : (
        <ol className="pool-storage-ranking">
          {people.map((p) => (
            <li key={p.name}>
              <span className="pool-storage-name">{p.name}</span>
              <span className="pool-storage-bar" aria-hidden="true">
                <span style={{ width: `${Math.max((p.bytes / largest) * 100, 1)}%` }} />
              </span>
              <span className="pool-storage-value">{formatSize(p.bytes)}</span>
            </li>
          ))}
        </ol>
      )}
      {emptyCount > 0 && people.length > 0 && (
        <p className="pool-storage-note">{emptyCount === 1 ? "1 person keeps" : `${emptyCount} people keep`} nothing at the moment.</p>
      )}
    </section>
  )
}

export default PoolStorage
