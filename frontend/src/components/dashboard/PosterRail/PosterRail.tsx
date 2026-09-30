import React from "react"
import { Clapperboard, Tv } from "lucide-react"
import { Arrival } from "../../../types/dashboardType"
import { formatFull, formatRelative } from "../../../shared/format"
import "./_posterRail.scss"

interface PosterRailProps {
  items: Arrival[]
  loading: boolean
}

// A horizontally scrolling row of the titles that most recently became watchable
const PosterRail: React.FC<PosterRailProps> = ({ items, loading }) => (
  <section className="poster-rail" aria-labelledby="poster-rail-title">
    <div className="poster-rail-header">
      <h2 id="poster-rail-title">Recently arrived</h2>
      <p>Newest downloads, ready to watch.</p>
    </div>
    {items.length === 0 ? (
      <p className="poster-rail-empty">{loading ? "Loading recent arrivals…" : "Nothing has arrived yet. New downloads appear here once they're imported."}</p>
    ) : (
      <ul className="poster-rail-track" tabIndex={0} aria-label="Recent arrivals, scrolls sideways">
        {items.map((item) => {
          const TypeIcon = item.type === "movie" ? Clapperboard : Tv
          return (
            <li key={`${item.type}-${item.tmdbId ?? item.title}`} className="poster-card">
              <div className="poster-art">
                {item.poster ? (
                  <img src={item.poster} alt="" loading="lazy" decoding="async" />
                ) : (
                  <span className="poster-placeholder" aria-hidden="true">{item.title.charAt(0)}</span>
                )}
              </div>
              <p className="poster-title">{item.title}</p>
              <p className="poster-meta">
                <TypeIcon aria-hidden="true" />
                <span className="visually-hidden">{item.type === "movie" ? "Movie" : "Series"},</span>
                {item.year ?? ""}
              </p>
              <p className="poster-added">
                <time dateTime={item.added} title={formatFull(item.added)}>{formatRelative(item.added)}</time>
              </p>
            </li>
          )
        })}
      </ul>
    )}
  </section>
)

export default PosterRail
