import React, { useState } from "react"
import { useDraggable } from "@dnd-kit/core"
import { Menu, MenuItem } from "@mui/material"
import { ArrowRightLeft, GripVertical, X } from "lucide-react"
import { poolItemBytes, PoolItemType } from "../../../../shared/userUtility"
import { formatSize } from "../../../../shared/format"
import { TransferTarget } from "../../UserCards"
import "./_draggable-pool-item.scss"

// The fields of a pool movie or series that the row needs
interface PoolItem {
  title: string
  year: number
  sizeOnDisk?: number
  seasons?: { statistics?: { sizeOnDisk?: number } }[]
}

interface DraggablePoolItemProps {
  userId: string
  itemType: PoolItemType
  itemIndex: number
  item: PoolItem
  removing: boolean
  isBeingRemoved: boolean
  onRemoveClick: (itemType: PoolItemType, itemIndex: number) => void
  onConfirmRemove: () => void
  onCancelRemove: () => void
  moveTargets: TransferTarget[]
  onMove: (destUserId: string) => void
}

// One title in a pool. Drag it by the handle onto another card, or use "Move to" for keyboard and touch
const DraggablePoolItem: React.FC<DraggablePoolItemProps> = ({
  userId,
  itemType,
  itemIndex,
  item,
  removing,
  isBeingRemoved,
  onRemoveClick,
  onConfirmRemove,
  onCancelRemove,
  moveTargets,
  onMove,
}) => {
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null)
  const label = `${item.title} (${item.year})`

  const { attributes, listeners, setNodeRef, setActivatorNodeRef, isDragging } = useDraggable({
    id: `${userId}-${itemType}-${itemIndex}`,
    data: { sourceUserId: userId, itemType, itemIndex, item },
  })

  return (
    <li ref={setNodeRef} className={`draggable-pool-item${isDragging ? " dragging" : ""}${isBeingRemoved ? " confirming" : ""}`}>
      <button
        type="button"
        ref={setActivatorNodeRef}
        className="pool-item-handle"
        {...listeners}
        {...attributes}
        aria-label={`Drag ${label} to another user`}
      >
        <GripVertical aria-hidden="true" />
      </button>

      <div className="pool-item-text">
        <span className="item-title">{label}</span>
        <span className="item-size">{formatSize(poolItemBytes(item, itemType))}</span>
      </div>

      {isBeingRemoved ? (
        <div className="pool-item-confirm" role="group" aria-label={`Remove ${label}?`}>
          <button type="button" className="pool-item-action pool-item-danger" onClick={onConfirmRemove} disabled={removing}>
            Remove
          </button>
          <button type="button" className="pool-item-action" onClick={onCancelRemove} disabled={removing} autoFocus>
            Keep
          </button>
        </div>
      ) : (
        <div className="pool-item-actions">
          {moveTargets.length > 0 && (
            <button
              type="button"
              className="pool-item-icon"
              aria-haspopup="menu"
              aria-expanded={Boolean(menuAnchor)}
              onClick={(e) => setMenuAnchor(e.currentTarget)}
            >
              <ArrowRightLeft aria-hidden="true" />
              <span className="visually-hidden">Move {label} to another user</span>
            </button>
          )}
          <button type="button" className="pool-item-icon pool-item-remove" onClick={() => onRemoveClick(itemType, itemIndex)}>
            <X aria-hidden="true" />
            <span className="visually-hidden">Remove {label} from this pool</span>
          </button>
        </div>
      )}

      <Menu anchorEl={menuAnchor} open={Boolean(menuAnchor)} onClose={() => setMenuAnchor(null)}>
        <MenuItem disabled>Move to</MenuItem>
        {moveTargets.map((target) => (
          <MenuItem
            key={target.id}
            onClick={() => {
              setMenuAnchor(null)
              onMove(target.id)
            }}
          >
            {target.name}
          </MenuItem>
        ))}
      </Menu>
    </li>
  )
}

export default DraggablePoolItem
