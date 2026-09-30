import React from "react"
import { Save } from "lucide-react"
import moment from "moment"
import Button from "../Button/Button"
import { SaveStatus } from "../../../shared/hooks/useSaveFeedback"
import "./_saveBar.scss"

interface SaveBarProps {
  loading: boolean
  status: SaveStatus
  savedAt: Date | null
  label?: string
  onClick?: () => void
}

// Describe the latest save outcome in words so it stays visible after any toast has gone
const statusText = (status: SaveStatus, savedAt: Date | null): string => {
  if (status === "saving") return "Saving…"
  if (status === "failed") return "Last save failed"
  if (status === "saved" && savedAt) return `Saved at ${moment(savedAt).format("HH:mm")}`
  return ""
}

// The primary save action for a settings page with a persistent note of the last outcome
const SaveBar: React.FC<SaveBarProps> = ({ loading, status, savedAt, label = "Save changes", onClick }) => {
  const text = statusText(status, savedAt)

  return (
    <div className="save-bar">
      <Button type={onClick ? "button" : "submit"} onClick={onClick} loading={loading} icon={<Save aria-hidden="true" />}>
        {label}
      </Button>
      {text && <p className={`save-bar-status save-bar-${status}`}>{text}</p>}
    </div>
  )
}

export default SaveBar
