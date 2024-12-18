import React, { MouseEvent } from "react"
import './_tidyPath.scss'
import { Edit } from "@mui/icons-material"
import { shortPath } from "../../../../shared/utility"
import { Checkbox } from "@mui/material"

interface TidyPathType {
  path: string
  disabled?: boolean
  onClick?: (e: MouseEvent<HTMLDivElement>) => void
  checked?: boolean
  onChecked?: (path: string) => void
  pathDepth?: number
  ellipsis?: boolean
  error?: boolean
}

const TidyPath: React.FC<TidyPathType> = ({ 
  path, 
  disabled, 
  onClick,
  checked,
  onChecked, 
  pathDepth, 
  ellipsis,
  error,
}) => {
  return (
    <div 
      className={`tidy-path${disabled ? " tidy-path-disabled" : ""}${error ? " tidy-path-error" : ""}`}
      onClick={(e) => {
        onClick?.(e)
        onChecked?.(path)
      }}
    >
      <p>{shortPath(path, pathDepth, ellipsis)}</p>
      {onClick && <Edit/>}
      {onChecked && 
        <Checkbox
          checked={checked}
          className="tidy-path-checkbox"
        />
      }
    </div>
  )
}

export default TidyPath
