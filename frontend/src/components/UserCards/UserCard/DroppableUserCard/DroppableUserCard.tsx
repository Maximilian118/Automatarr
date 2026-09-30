import React from "react"
import { useDroppable } from "@dnd-kit/core"
import { BotUserType, settingsType } from "../../../../types/settingsType"
import { PoolItemType } from "../../../../shared/userUtility"
import { TransferTarget } from "../../UserCards"
import UserCard from "../UserCard"
import "./_droppable-user-card.scss"

interface DroppableUserCardProps {
  user: BotUserType
  settings: settingsType
  onSettingsUpdate: (newSettings: settingsType) => void
  isOwner: boolean
  transferTargets: TransferTarget[]
  onTransfer: (sourceUserId: string, destUserId: string, itemType: PoolItemType, itemIndex: number, title: string) => Promise<void>
}

// Wrapper that makes a UserCard a valid drop target for drag-and-drop transfers
const DroppableUserCard: React.FC<DroppableUserCardProps> = ({ user, settings, onSettingsUpdate, isOwner, transferTargets, onTransfer }) => {
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
        transferTargets={transferTargets}
        onTransfer={onTransfer}
      />
    </div>
  )
}

export default DroppableUserCard
