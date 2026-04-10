import React, { useMemo, useState } from "react"
import { Alert } from "@mui/material"
import { DndContext, DragOverlay, DragStartEvent, DragEndEvent, PointerSensor, useSensor, useSensors, closestCenter } from "@dnd-kit/core"
import { settingsType } from "../../types/settingsType"
import { BotUserType } from "../../types/settingsType"
import { calculateUserTotalStorageBytes } from "./UserCard/UserCard"
import { transferPoolItem } from "../../shared/requests/settingsRequests"
import DroppableUserCard from "./UserCard/DroppableUserCard/DroppableUserCard"
import DragOverlayItem from "./DragOverlayItem/DragOverlayItem"
import "./user-cards.scss"

interface DragItemData {
  sourceUserId: string
  itemType: "movies" | "series"
  itemIndex: number
  item: { title: string; year: number }
}

interface UserCardsProps {
  users: BotUserType[]
  settings: settingsType
  onSettingsUpdate: (newSettings: settingsType) => void
}

const UserCards: React.FC<UserCardsProps> = ({ users, settings, onSettingsUpdate }) => {
  const [activeDragItem, setActiveDragItem] = useState<DragItemData | null>(null)

  // Require 8px of movement before starting a drag to avoid conflicts with scrolling and clicks
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    })
  )

  // Sort users by total storage used in descending order
  const sortedUsers = useMemo(() => {
    return [...users].sort((a, b) => calculateUserTotalStorageBytes(b) - calculateUserTotalStorageBytes(a))
  }, [users])

  // The first user in the original (unsorted) array is the owner
  const ownerId = users.length > 0 ? users[0]._id : null

  // Store the dragged item data when a drag starts
  const handleDragStart = (event: DragStartEvent) => {
    const data = event.active.data.current as DragItemData | undefined
    if (data) {
      setActiveDragItem(data)
    }
  }

  // Transfer the pool item to the destination user when a drag ends on a different card
  const handleDragEnd = async (event: DragEndEvent) => {
    const { over } = event

    if (!activeDragItem || !over) {
      setActiveDragItem(null)
      return
    }

    const destUserId = over.id as string

    // Only transfer if dropping on a different user
    if (destUserId === activeDragItem.sourceUserId) {
      setActiveDragItem(null)
      return
    }

    try {
      const updatedSettings = await transferPoolItem(
        activeDragItem.sourceUserId,
        destUserId,
        activeDragItem.itemType,
        activeDragItem.itemIndex
      )
      onSettingsUpdate(updatedSettings)
    } catch (error) {
      console.error("Failed to transfer pool item:", error)
    }

    setActiveDragItem(null)
  }

  return (
    <div className="users-cards">
      {sortedUsers.length === 0 ? (
        <Alert severity="info">No users found</Alert>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="users-grid">
            {sortedUsers.map((user) => (
              <DroppableUserCard
                key={user._id}
                user={user}
                settings={settings}
                onSettingsUpdate={onSettingsUpdate}
                isOwner={user._id === ownerId}
              />
            ))}
          </div>

          <DragOverlay>
            {activeDragItem ? (
              <DragOverlayItem
                title={activeDragItem.item.title}
                year={activeDragItem.item.year}
              />
            ) : null}
          </DragOverlay>
        </DndContext>
      )}
    </div>
  )
}

export default UserCards
