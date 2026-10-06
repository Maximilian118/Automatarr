import React from "react"
import { X } from "lucide-react"
import "./_nicknameTags.scss"

interface NicknameTagsProps {
  label: string // What the list is, e.g. "Calls Automatarr"
  nicknames: string[]
  disabled?: boolean
  onRemove: (index: number) => void
}

// A labelled row of nicknames, each with a button to remove it. Renders nothing when the list is empty.
const NicknameTags: React.FC<NicknameTagsProps> = ({ label, nicknames, disabled, onRemove }) => {
  if (nicknames.length === 0) return null

  return (
    <div className="nickname-tags">
      <span className="nickname-tags-label">{label}</span>
      <ul aria-label={label}>
        {nicknames.map((nickname, index) => (
          <li key={nickname}>
            <span>{nickname}</span>
            <button type="button" disabled={disabled} onClick={() => onRemove(index)}>
              <X aria-hidden="true"/>
              <span className="visually-hidden">Remove nickname {nickname}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

export default NicknameTags
