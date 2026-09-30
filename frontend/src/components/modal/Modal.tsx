import React, { ReactNode, useId } from "react"
import { Dialog, DialogContent } from "@mui/material"
import { X } from "lucide-react"
import Button from "../ui/Button/Button"
import './_modal.scss'

// Action buttons displayed at the bottom of the modal
export type ModalAction = {
  label: string
  onClick: () => void
  variant?: "text" | "contained" | "outlined"
  color?: string
  disabled?: boolean
  loading?: boolean
  align?: "left" | "right"
}

interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  icon?: ReactNode
  actions?: ModalAction[]
  customLeftActions?: ReactNode
  customRightActions?: ReactNode
  children: ReactNode
}

// A base modal container with a header, close button, content slot, and action buttons.
// The last right-aligned action is the primary one; error-coloured actions render as danger buttons
const Modal: React.FC<ModalProps> = ({ open, onClose, title, icon, actions, customLeftActions, customRightActions, children }) => {
  const titleId = useId()

  // Split actions into left-aligned and right-aligned groups
  const leftActions = actions?.filter((a) => a.align === "left") ?? []
  const rightActions = actions?.filter((a) => a.align !== "left") ?? []
  const primary = rightActions[rightActions.length - 1]

  // Render one action with the variant that matches its role
  const renderAction = (action: ModalAction, variant: "primary" | "secondary", key: number | string) => (
    <Button
      key={key}
      variant={action.color === "error" ? "danger" : variant}
      onClick={action.onClick}
      disabled={action.disabled}
      loading={action.loading}
    >
      {action.label}
    </Button>
  )

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      aria-labelledby={titleId}
      PaperProps={{ className: "modal-paper" }}
    >
      <div className="modal-header">
        <div className="modal-title">
          {icon && (typeof icon === "string" ? <img src={icon} alt="" /> : icon)}
          <h2 id={titleId}>{title}</h2>
        </div>
        <button type="button" className="modal-close" onClick={onClose}>
          <X aria-hidden="true" />
          <span className="visually-hidden">Close</span>
        </button>
      </div>
      <DialogContent className="modal-content">
        {children}
        {((actions && actions.length > 0) || customLeftActions || customRightActions) && (
          <div className="modal-actions">
            <div className="modal-actions-left">
              {customLeftActions}
              {leftActions.map((action, i) => renderAction(action, "secondary", i))}
            </div>
            <div className="modal-actions-right">
              {rightActions.slice(0, -1).map((action, i) => renderAction(action, "secondary", i))}
              {customRightActions}
              {primary && renderAction(primary, "primary", "primary")}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

export default Modal
