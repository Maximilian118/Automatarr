import React, { ReactNode } from "react"
import { noticeIcons } from "./noticeIcons"
import "./_notice.scss"

export type NoticeTone = "info" | "warn" | "error"

interface NoticeProps {
  tone: NoticeTone
  children: ReactNode
  title?: string
}

// A boxed message with an icon and words, so its meaning never relies on colour alone.
// Errors are announced straight away; warnings and information are not
const Notice: React.FC<NoticeProps> = ({ tone, children, title }) => {
  const Icon = noticeIcons[tone]

  return (
    <div className={`notice notice-${tone}`} role={tone === "error" ? "alert" : undefined}>
      <Icon aria-hidden="true" />
      <div className="notice-body">
        {title && <p className="notice-title">{title}</p>}
        {children}
      </div>
    </div>
  )
}

export default Notice
