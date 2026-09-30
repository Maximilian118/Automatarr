import React, { MouseEvent } from "react"
import './_tidyPath.scss'
import { Pencil } from "lucide-react"
import { shortPath } from "../../../../shared/utility"
import { Checkbox } from "@mui/material"

interface TidyPathType {
  path: string
  disabled?: boolean
  onClick?: (e: MouseEvent<HTMLButtonElement>) => void
  checked?: boolean
  onChecked?: (path: string) => void
  pathDepth?: number
  ellipsis?: boolean
  error?: boolean
}

// One folder row. Opening a watched path is a button; choosing allowed folders is a labelled checkbox
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
  const classes = `tidy-path${disabled ? " tidy-path-disabled" : ""}${error ? " tidy-path-error" : ""}`
  const text = shortPath(path, pathDepth, ellipsis)

  if (onChecked) {
    return (
      <label className={classes}>
        <span className="tidy-path-text">{text}</span>
        <Checkbox
          checked={!!checked}
          disabled={disabled}
          onChange={() => onChecked(path)}
          className="tidy-path-checkbox"
          inputProps={{ 'aria-label': `Keep ${path}` }}
        />
      </label>
    )
  }

  return (
    <button type="button" className={classes} onClick={onClick} disabled={disabled}>
      <span className="tidy-path-text">{text}</span>
      {error && <span className="tidy-path-warning">Choose at least one folder to keep</span>}
      <Pencil aria-hidden="true"/>
      <span className="visually-hidden">Edit the folders kept in {path}</span>
    </button>
  )
}

export default TidyPath
