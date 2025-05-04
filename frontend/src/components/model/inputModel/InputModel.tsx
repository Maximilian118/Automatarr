import React, { ReactNode } from "react"
import '../model.scss'
import { statusColours } from "../modelUtility"

interface InputModelType {
  children: ReactNode
  title?: string
  startIcon?: ReactNode
  status?: "Connected" | "Disconnected"
}

const InputModel: React.FC<InputModelType> = ({ children, title, startIcon, status }) => {
  return (
    <div className="model">
      <div className="model-top">
        <div className="model-top-left">
          {typeof startIcon === "string" ? <img alt="API Symbol" src={startIcon} /> : startIcon}
          {title && <h2>{title}</h2>}
        </div>
        {status && <p style={{ color: statusColours(status) }}>{status}</p>}
      </div>
      {children}
    </div>
  )
}

export default InputModel
