import { createContext } from "react"

export type ToastTone = "success" | "error" | "info"

export interface ToastInput {
  tone: ToastTone
  title: string
  message?: string
}

export interface Toast extends ToastInput {
  id: number
}

export interface ToastContextType {
  showToast: (toast: ToastInput) => void
}

export const ToastContext = createContext<ToastContextType | null>(null)
