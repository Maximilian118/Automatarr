import React, { ReactNode } from "react"
import { CircleAlert } from "lucide-react"
import "./_list_card.scss"

interface ListCardProps {
  title: string
  enabled?: boolean
  error?: boolean
  errorMessage?: string
  tags?: string[]
  onClick?: () => void
  children?: ReactNode
}

// A compact card for one import list. The title is the button, and its hit area stretches over the whole card
const ListCard: React.FC<ListCardProps> = ({ title, enabled = true, error = false, errorMessage, tags, onClick, children }) => (
  <article className={`list-card${error ? " error" : ""}`}>
    <div className="list-card-header">
      <h3>
        <button type="button" className="list-card-open" onClick={onClick}>
          {title}
          <span className="visually-hidden">, edit list</span>
        </button>
      </h3>
      <span className={`list-card-status ${enabled ? "enabled" : "disabled"}`}>{enabled ? "On" : "Off"}</span>
    </div>
    {children}
    {error && errorMessage ? (
      <p className="list-card-error">
        <CircleAlert aria-hidden="true" />
        {errorMessage}
      </p>
    ) : (
      tags && tags.length > 0 && (
        <ul className="list-card-meta" aria-label="Details">
          {tags.map((tag, i) => (
            <li key={i} className="list-card-tag">{tag}</li>
          ))}
        </ul>
      )
    )}
  </article>
)

export default ListCard
