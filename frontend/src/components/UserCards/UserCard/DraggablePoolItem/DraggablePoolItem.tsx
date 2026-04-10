import React, { useState } from "react"
import { useDraggable } from "@dnd-kit/core"
import { Typography, IconButton, Button, Collapse } from "@mui/material"
import { Clear, CheckCircle } from "@mui/icons-material"
import { formatBytes } from "../../../../shared/utility"
import "./draggable-pool-item.scss"

interface DraggablePoolItemProps {
  userId: string
  itemType: "movies" | "series"
  itemIndex: number
  item: any
  removing: boolean
  isBeingRemoved: boolean
  onRemoveClick: (itemType: "movies" | "series", itemIndex: number) => void
  onConfirmRemove: () => void
  onCancelRemove: () => void
}

// Calculate the storage size for a single pool item
const getItemStorage = (item: any, itemType: "movies" | "series"): string => {
  if (itemType === "movies") {
    return formatBytes(item.sizeOnDisk || 0)
  }

  // For series, calculate total size from all seasons
  let totalBytes = 0
  if (item.seasons) {
    item.seasons.forEach((season: any) => {
      if (season.statistics && season.statistics.sizeOnDisk) {
        totalBytes += season.statistics.sizeOnDisk
      }
    })
  }
  return formatBytes(totalBytes)
}

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
}) => {
  const [hovered, setHovered] = useState(false)

  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `${userId}-${itemType}-${itemIndex}`,
    data: { sourceUserId: userId, itemType, itemIndex, item },
  })

  return (
    <div
      ref={setNodeRef}
      className={`draggable-pool-item ${isDragging ? "dragging" : ""}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      {...listeners}
      {...attributes}
    >
      <Typography variant="body2" className="item-title">
        <span className={`title-text ${hovered ? "fade-out" : "fade-in"}`}>
          {item.title} ({item.year})
        </span>
        <span className={`storage-text ${hovered ? "fade-in" : "fade-out"}`}>
          {getItemStorage(item, itemType)}
        </span>
      </Typography>

      <div className="item-actions">
        <Collapse in={isBeingRemoved} orientation="horizontal">
          <div className="action-buttons">
            <Button
              size="small"
              variant="contained"
              color="error"
              onClick={onConfirmRemove}
              disabled={removing}
              startIcon={<CheckCircle />}
              className="confirm-button"
            >
              Yes
            </Button>
            <Button
              size="small"
              variant="outlined"
              onClick={onCancelRemove}
              disabled={removing}
              className="confirm-button"
            >
              No
            </Button>
          </div>
        </Collapse>

        <Collapse in={!isBeingRemoved} orientation="horizontal">
          <IconButton
            size="small"
            color="error"
            onClick={() => onRemoveClick(itemType, itemIndex)}
            className="delete-button"
          >
            <Clear />
          </IconButton>
        </Collapse>
      </div>
    </div>
  )
}

export default DraggablePoolItem
