import { ButtonHTMLAttributes, forwardRef, ReactNode } from "react"
import { CircularProgress } from "@mui/material"
import "./_button.scss"

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger"

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  icon?: ReactNode
  iconPosition?: "start" | "end"
  loading?: boolean
  fullWidth?: boolean
}

// The one button used across the app. Always at least 44px tall, shows a spinner while loading,
// and exposes the busy state to assistive technology
const Button = forwardRef<HTMLButtonElement, ButtonProps>(({
  variant = "primary",
  icon,
  iconPosition = "start",
  loading = false,
  fullWidth = false,
  className,
  children,
  disabled,
  type = "button",
  ...rest
}, ref) => {
  const iconNode = loading ? <CircularProgress size={18} color="inherit" aria-hidden="true" /> : icon
  const classes = ["btn", `btn-${variant}`, fullWidth ? "btn-full" : "", className ?? ""]
    .filter(Boolean)
    .join(" ")

  return (
    <button {...rest} ref={ref} type={type} className={classes} disabled={disabled} aria-busy={loading || undefined}>
      {iconNode && iconPosition === "start" && <span className="btn-icon">{iconNode}</span>}
      {children && <span className="btn-label">{children}</span>}
      {iconNode && iconPosition === "end" && <span className="btn-icon">{iconNode}</span>}
    </button>
  )
})

Button.displayName = "Button"

export default Button
