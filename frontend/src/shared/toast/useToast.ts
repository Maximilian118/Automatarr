import { useContext } from "react"
import { ToastContext, ToastContextType } from "./toastContext"

// Show a status toast from anywhere inside ToastProvider
export const useToast = (): ToastContextType => {
  const context = useContext(ToastContext)
  if (!context) throw new Error("useToast must be used inside ToastProvider")
  return context
}
