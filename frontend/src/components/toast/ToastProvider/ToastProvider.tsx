import React, { ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react"
import { CircleAlert, CircleCheck, Info, X } from "lucide-react"
import { Toast, ToastContext, ToastInput, ToastTone } from "../../../shared/toast/toastContext"
import "./_toastProvider.scss"

interface ToastProviderProps {
  children: ReactNode
}

// How long a success/info toast stays on screen while not hovered or focused. Errors stay until dismissed
const AUTO_HIDE_MS = 8000

const toneIcons: Record<ToastTone, React.ReactNode> = {
  success: <CircleCheck aria-hidden="true" />,
  error: <CircleAlert aria-hidden="true" />,
  info: <Info aria-hidden="true" />,
}

interface ToastItemProps {
  toast: Toast
  onDismiss: (id: number) => void
}

// A single toast. Pauses its timer while the pointer or keyboard focus is inside it
const ToastItem: React.FC<ToastItemProps> = ({ toast, onDismiss }) => {
  const [paused, setPaused] = useState(false)

  // Auto-hide non-error toasts after a delay, unless the viewer is interacting with them
  useEffect(() => {
    if (toast.tone === "error" || paused) return
    const timer = window.setTimeout(() => onDismiss(toast.id), AUTO_HIDE_MS)
    return () => window.clearTimeout(timer)
  }, [toast, paused, onDismiss])

  return (
    <li
      className={`toast toast-${toast.tone}`}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <span className="toast-icon">{toneIcons[toast.tone]}</span>
      <div className="toast-text">
        <p className="toast-title">{toast.title}</p>
        {toast.message && <p className="toast-message">{toast.message}</p>}
      </div>
      <button type="button" className="toast-dismiss" onClick={() => onDismiss(toast.id)}>
        <X aria-hidden="true" />
        <span className="visually-hidden">Dismiss notification</span>
      </button>
    </li>
  )
}

// Provides showToast() and renders the toast stack inside persistent live regions (WCAG 4.1.3)
const ToastProvider: React.FC<ToastProviderProps> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([])
  const nextId = useRef(1)

  // Add a toast to the stack, keeping at most four on screen
  const showToast = useCallback((input: ToastInput) => {
    const id = nextId.current++
    setToasts((prev) => [...prev, { ...input, id }].slice(-4))
  }, [])

  // Remove a toast by id
  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const value = useMemo(() => ({ showToast }), [showToast])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-region">
        {/* Errors are announced immediately; everything else politely */}
        <ul className="toast-stack" role="alert" aria-label="Errors">
          {toasts.filter((t) => t.tone === "error").map((t) => (
            <ToastItem key={t.id} toast={t} onDismiss={dismiss} />
          ))}
        </ul>
        <ul className="toast-stack" role="status" aria-label="Notifications">
          {toasts.filter((t) => t.tone !== "error").map((t) => (
            <ToastItem key={t.id} toast={t} onDismiss={dismiss} />
          ))}
        </ul>
      </div>
    </ToastContext.Provider>
  )
}

export default ToastProvider
