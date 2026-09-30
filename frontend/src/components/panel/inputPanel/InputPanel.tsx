import React, { ReactNode, useId } from "react"
import '../_panel.scss'
import { multilineText } from "../../../shared/utility"
import { Switch } from "@mui/material"
import StatusBadge from "../StatusBadge/StatusBadge"

interface InputPanelType {
  children: ReactNode
  title?: string
  startIcon?: ReactNode
  status?: "Connected" | "Disconnected"
  description?: string
  bottom?: JSX.Element
  checked?: boolean
  onToggle?: (value: boolean) => void
  disabled?: boolean
  headingLevel?: 2 | 3
}

// A panel container for form inputs with a title, icon, optional status indicator, and toggle
const InputPanel: React.FC<InputPanelType> = ({
  children,
  title,
  startIcon,
  status,
  description,
  bottom,
  checked,
  onToggle,
  disabled,
  headingLevel = 2,
}) => {
  const headingId = useId()
  const Heading = `h${headingLevel}` as "h2" | "h3"

  const handleSwitchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (onToggle) {
      onToggle(event.target.checked)
    }
  }

  return (
    <section className={`panel${bottom ? " panel-has-bottom" : ""}`} aria-labelledby={title ? headingId : undefined}>
      {/* Panel header — only rendered when there is a title, status, or toggle */}
      {(title || startIcon || status || onToggle) && (
        <div className="panel-top">
          <div className="panel-top-left">
            {typeof startIcon === "string" ? <img alt="" src={startIcon} /> : startIcon}
            {title && <Heading id={headingId}>{title}</Heading>}
          </div>
          <div className="panel-top-right">
            {status && <StatusBadge status={status} />}
            {onToggle && (
              <Switch
                checked={checked}
                onChange={handleSwitchChange}
                inputProps={{ 'aria-label': title ? `Enable ${title}` : "Enable" }}
                disabled={disabled}
              />
            )}
          </div>
        </div>
      )}
      {description && multilineText(description, "panel-description")}
      {children}
      {bottom && (
        <div className="panel-bottom">
          {bottom}
        </div>
      )}
    </section>
  )
}

export default InputPanel
