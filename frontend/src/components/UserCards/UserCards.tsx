import React, { useCallback, useMemo, useState } from "react"
import {
  DndContext,
  DragOverlay,
  DragStartEvent,
  DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
} from "@dnd-kit/core"
import { settingsType } from "../../types/settingsType"
import { BotUserType } from "../../types/settingsType"
import { calculateUserTotalStorageBytes, PoolItemType } from "../../shared/userUtility"
import { transferPoolItem } from "../../shared/requests/settingsRequests"
import { useToast } from "../../shared/toast/useToast"
import DroppableUserCard from "./UserCard/DroppableUserCard/DroppableUserCard"
import DragOverlayItem from "./DragOverlayItem/DragOverlayItem"
import "./_user-cards.scss"

interface DragItemData {
  sourceUserId: string
  itemType: PoolItemType
  itemIndex: number
  item: { title: string; year: number }
}

export interface TransferTarget {
  id: string
  name: string
}

interface UserCardsProps {
  users: BotUserType[]
  settings: settingsType
  onSettingsUpdate: (newSettings: settingsType) => void
}

// Every user's pool as a card. Items move between users by dragging or through each item's "Move to" menu
const UserCards: React.FC<UserCardsProps> = ({ users, settings, onSettingsUpdate }) => {
  const [activeDragItem, setActiveDragItem] = useState<DragItemData | null>(null)
  const { showToast } = useToast()

  // Require 8px of movement before a pointer drag starts, so taps and scrolling still work.
  // The keyboard sensor lets the drag handle be picked up with Space or Enter
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(KeyboardSensor),
  )

  // Sort users by total storage used in descending order
  const sortedUsers = useMemo(() => {
    return [...users].sort((a, b) => calculateUserTotalStorageBytes(b) - calculateUserTotalStorageBytes(a))
  }, [users])

  // Everyone a pool item can be moved to
  const transferTargets: TransferTarget[] = useMemo(
    () => users.filter((u) => u._id).map((u) => ({ id: u._id as string, name: u.name })),
    [users],
  )

  // The first user in the original (unsorted) array is the owner
  const ownerId = users.length > 0 ? users[0]._id : null

  // Move one pool item from one user to another, reporting the outcome
  const transferItem = useCallback(
    async (sourceUserId: string, destUserId: string, itemType: PoolItemType, itemIndex: number, title: string) => {
      if (sourceUserId === destUserId) return

      const destName = users.find((u) => u._id === destUserId)?.name ?? "the other user"

      try {
        const updatedSettings = await transferPoolItem(sourceUserId, destUserId, itemType, itemIndex)
        onSettingsUpdate(updatedSettings)
        showToast({ tone: "success", title: `Moved ${title} to ${destName}` })
      } catch (error) {
        console.error("Failed to transfer pool item:", error)
        showToast({ tone: "error", title: `Couldn't move ${title}`, message: "The pool wasn't changed. Try again." })
      }
    },
    [users, onSettingsUpdate, showToast],
  )

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
    const dragged = activeDragItem
    setActiveDragItem(null)

    if (!dragged || !over) return

    await transferItem(dragged.sourceUserId, over.id as string, dragged.itemType, dragged.itemIndex, dragged.item.title)
  }

  if (sortedUsers.length === 0) {
    return (
      <div className="users-empty">
        <h2>No users yet</h2>
        <p>People appear here once an admin approves them in Discord with the init command, or automatically if auto-initialise is on in Bots.</p>
      </div>
    )
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveDragItem(null)}
    >
      <ul className="users-grid">
        {sortedUsers.map((user) => (
          <li key={user._id}>
            <DroppableUserCard
              user={user}
              settings={settings}
              onSettingsUpdate={onSettingsUpdate}
              isOwner={user._id === ownerId}
              transferTargets={transferTargets}
              onTransfer={transferItem}
            />
          </li>
        ))}
      </ul>

      <DragOverlay>
        {activeDragItem ? (
          <DragOverlayItem
            title={activeDragItem.item.title}
            year={activeDragItem.item.year}
          />
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}

export default UserCards
