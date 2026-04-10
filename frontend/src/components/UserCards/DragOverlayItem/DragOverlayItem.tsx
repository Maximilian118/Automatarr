import React from "react"
import "./drag-overlay-item.scss"

interface DragOverlayItemProps {
  title: string
  year: number
}

// Floating preview pill displayed while dragging a pool item
const DragOverlayItem: React.FC<DragOverlayItemProps> = ({ title, year }) => {
  return (
    <div className="drag-overlay-item">
      {title} ({year})
    </div>
  )
}

export default DragOverlayItem
