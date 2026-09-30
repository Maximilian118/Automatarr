import React from "react"
import { CircleCheck, CircleX } from "lucide-react"
import "./_statusBadge.scss"

interface StatusBadgeProps {
  status: "Connected" | "Disconnected"
}

// Connection status as icon plus words, so it never relies on colour alone
const StatusBadge: React.FC<StatusBadgeProps> = ({ status }) => {
  const connected = status === "Connected"
  const Icon = connected ? CircleCheck : CircleX

  return (
    <span className={`status-badge ${connected ? "status-badge-good" : "status-badge-bad"}`}>
      <Icon aria-hidden="true" />
      {status}
    </span>
  )
}

export default StatusBadge
