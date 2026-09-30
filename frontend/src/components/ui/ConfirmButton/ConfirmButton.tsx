import React, { ReactNode, useEffect, useRef, useState } from "react"
import Button, { ButtonVariant } from "../Button/Button"
import "./_confirmButton.scss"

interface ConfirmButtonProps {
  label: string
  confirmLabel: string
  question: string
  onConfirm: () => void | Promise<void>
  icon?: ReactNode
  variant?: ButtonVariant
  loading?: boolean
  disabled?: boolean
}

// A destructive action that asks before it acts (WCAG 3.3.6). The question has no time limit;
// it stays until the viewer confirms or cancels
const ConfirmButton: React.FC<ConfirmButtonProps> = ({
  label,
  confirmLabel,
  question,
  onConfirm,
  icon,
  variant = "danger",
  loading,
  disabled,
}) => {
  const [confirming, setConfirming] = useState(false)
  const cancelRef = useRef<HTMLButtonElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const wasConfirming = useRef(false)

  // Move focus into the question when it opens, and back to the trigger when it closes
  useEffect(() => {
    if (confirming) cancelRef.current?.focus()
    else if (wasConfirming.current) triggerRef.current?.focus()
    wasConfirming.current = confirming
  }, [confirming])

  if (!confirming) {
    return (
      <Button ref={triggerRef} variant={variant} icon={icon} loading={loading} disabled={disabled} onClick={() => setConfirming(true)}>
        {label}
      </Button>
    )
  }

  return (
    <div className="confirm-button" role="group" aria-label={question}>
      <p className="confirm-button-question">{question}</p>
      <div className="confirm-button-actions">
        <Button ref={cancelRef} variant="secondary" onClick={() => setConfirming(false)}>
          Cancel
        </Button>
        <Button
          variant="danger"
          icon={icon}
          loading={loading}
          onClick={async () => {
            await onConfirm()
            setConfirming(false)
          }}
        >
          {confirmLabel}
        </Button>
      </div>
    </div>
  )
}

export default ConfirmButton
