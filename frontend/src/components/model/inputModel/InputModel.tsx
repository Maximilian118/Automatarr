import React, { ReactNode } from "react"
import './input-model.scss'

interface InputModelType {
  children: ReactNode
  title?: string
  startIcon?: string
  status?: "Connected" | "Disconnected"
}

const statusColours = (status: string): string => {
  switch (status) {
    case "Connected": return "#66bb6a"
    case "Disconnected": return "#F44336"
    default: return "#F44336"
  }
}

// Use `InputModelType` directly for your component.
const InputModel: React.FC<InputModelType> = ({ children, title, startIcon, status }) => {
  return (
    <div className="input-model">
      <div className="input-model-top">
        <div className="input-model-top-left">
          {startIcon && <img alt="API Symbol" src={startIcon} />}
          {title && <h2>{title}</h2>}
        </div>
        {status && <p style={{ color: statusColours(status) }}>{status}</p>}
      </div>
      {children}
    </div>
  )
}

export default InputModel
