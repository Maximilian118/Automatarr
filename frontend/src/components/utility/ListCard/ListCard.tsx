import React, { ReactNode } from "react"
import { FiberManualRecord } from "@mui/icons-material"
import { Tooltip } from "@mui/material"
import "./_list_card.scss"

// Tags can be plain strings or objects with optional color
export type ListCardTag = string | { text: string; color?: string }

interface ListCardProps {
  title: string
  enabled?: boolean
  error?: boolean
  errorMessage?: string
  tags?: ListCardTag[]
  onClick?: () => void
  children?: ReactNode
}

// A compact clickable card with a status indicator, title, optional content, and metadata tags
const ListCard: React.FC<ListCardProps> = ({ title, enabled = true, error = false, errorMessage, tags, onClick, children }) => {
  const card = (
    <div className={`list-card${error ? " error" : ""}`} onClick={onClick}>
      <div className="list-card-header">
        <FiberManualRecord
          className={`list-card-status ${enabled ? "enabled" : "disabled"}`}
        />
        <h3>{title}</h3>
      </div>
      {children}
      {error && errorMessage ? (
        <div className="list-card-meta">
          <span className="list-card-error-tag">{errorMessage}</span>
        </div>
      ) : (
        tags && tags.length > 0 && (
          <div className="list-card-meta">
            {tags.map((tag, i) => {
              const text = typeof tag === "string" ? tag : tag.text
              const color = typeof tag === "string" ? undefined : tag.color
              return (
                <span key={i} className="list-card-tag" style={color ? { color } : undefined}>
                  {text}
                </span>
              )
            })}
          </div>
        )
      )}
    </div>
  )

  // Wrap in tooltip when there's an error message
  if (error && errorMessage) {
    return (
      <Tooltip
        title={errorMessage}
        arrow
        placement="top"
        slotProps={{
          tooltip: { className: "list-card-tooltip" },
          arrow: { className: "list-card-tooltip-arrow" },
        }}
      >
        {card}
      </Tooltip>
    )
  }

  return card
}

export default ListCard
