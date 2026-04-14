import React, { ReactNode } from "react"
import { Button, CircularProgress, Dialog, DialogContent, IconButton } from "@mui/material"
import { Close } from "@mui/icons-material"
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
  customRightActions?: ReactNode
  children: ReactNode
}

// A base modal container with a header, close button, content slot, and action buttons
const Modal: React.FC<ModalProps> = ({ open, onClose, title, icon, actions, customRightActions, children }) => {
  // Split actions into left-aligned and right-aligned groups
  const leftActions = actions?.filter((a) => a.align === "left") ?? []
  const rightActions = actions?.filter((a) => a.align !== "left") ?? []

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="xs"
      fullWidth
      PaperProps={{ className: "modal-paper" }}
    >
      <div className="modal-header">
        <div className="modal-title">
          {icon && (typeof icon === "string" ? <img src={icon} alt="" /> : icon)}
          <h2>{title}</h2>
        </div>
        <IconButton size="small" onClick={onClose}>
          <Close />
        </IconButton>
      </div>
      <DialogContent className="modal-content">
        {children}
        {actions && actions.length > 0 && (
          <div className="modal-actions">
            {leftActions.map((action, i) => (
              <Button
                key={i}
                variant="contained"
                onClick={action.onClick}
                disabled={action.disabled}
                className={action.color === "error" ? "modal-action-danger" : "modal-action-cancel"}
              >
                {action.loading ? <CircularProgress size={20} color="inherit" /> : action.label}
              </Button>
            ))}
            <div className="modal-actions-right">
              {rightActions.slice(0, -1).map((action, i) => (
                <Button
                  key={i}
                  variant="contained"
                  onClick={action.onClick}
                  disabled={action.disabled}
                  className="modal-action-cancel"
                >
                  {action.loading ? <CircularProgress size={20} color="inherit" /> : action.label}
                </Button>
              ))}
              {customRightActions}
              {rightActions.length > 0 && (() => {
                const last = rightActions[rightActions.length - 1]
                return (
                  <Button
                    variant="contained"
                    onClick={last.onClick}
                    disabled={last.disabled}
                  >
                    {last.loading ? <CircularProgress size={20} color="inherit" /> : last.label}
                  </Button>
                )
              })()}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

export default Modal
