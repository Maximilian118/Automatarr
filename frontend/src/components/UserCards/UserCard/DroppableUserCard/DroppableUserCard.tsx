import React from "react"
import { useDroppable } from "@dnd-kit/core"
import { BotUserType, settingsType } from "../../../../types/settingsType"
import UserCard from "../UserCard"
import "./_droppable-user-card.scss"

interface DroppableUserCardProps {
  user: BotUserType
  settings: settingsType
  onSettingsUpdate: (newSettings: settingsType) => void
  isOwner: boolean
}

// Wrapper that makes a UserCard a valid drop target for drag-and-drop transfers
const DroppableUserCard: React.FC<DroppableUserCardProps> = ({ user, settings, onSettingsUpdate, isOwner }) => {
  const { setNodeRef, isOver } = useDroppable({
    id: user._id || "",
  })

  return (
    <div ref={setNodeRef} className={`droppable-user-card ${isOver ? "drop-target" : ""}`}>
      <UserCard
        user={user}
        settings={settings}
        onSettingsUpdate={onSettingsUpdate}
        isOwner={isOwner}
      />
    </div>
  )
}

export default DroppableUserCard
