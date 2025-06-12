import React, { Dispatch, SetStateAction, useEffect, useState } from "react"
import './editPath.scss'
import { settingsType, tidyPaths } from "../../../../types/settingsType"
import TidyPath from "../TidyPath/TidyPath"
import { getChildPaths } from "../../../../shared/requests/fileSystemRequests"
import { UserType } from "../../../../types/userType"
import { useNavigate } from "react-router-dom"

interface EditPathType {
  editPath: tidyPaths
  value: string | null
  setValue: Dispatch<SetStateAction<string | null>>
  user: UserType
  setUser: Dispatch<SetStateAction<UserType>>
  setSettings: Dispatch<SetStateAction<settingsType>>
  setLoading: Dispatch<SetStateAction<boolean>>
  path?: tidyPaths
  disabled?: boolean
}

const EditPath: React.FC<EditPathType> = ({ 
  editPath, 
  value, 
  setValue,
  user,
  setUser,
  setSettings,
  setLoading,
  path,
  disabled,
}) => {
  const [ children, setChildren ] = useState<string[]>([]) // Children of the current value/path in the host fs

  const navigate = useNavigate()

  // Ensure the input value of the autocomplete is null
  useEffect(() => {
    if (value) {
      setValue(null)
    }
  }, [value, setValue])

  // Get all of the children for this path
  useEffect(() => {
    if (!disabled) {
      getChildPaths(editPath.path, setChildren, setLoading, user, setUser, navigate)
    }
  }, [editPath, disabled, setLoading, user, setUser, navigate])

  return (
    <div className={`edit-path ${disabled ? " edit-path-disabled" : ""}`}>
      {children.map((child, i) => 
        <TidyPath
          key={i}
          path={child}
          disabled={disabled}
          pathDepth={1}
          ellipsis={false}
          checked={path && path.allowedDirs.some(p => p === child)}
          onChecked={(path) => {
            setSettings(prevSettings => {
              return {
                ...prevSettings,
                tidy_directories_paths: prevSettings.tidy_directories_paths.map(p => {
                  if (p.path === editPath.path) {
                    return {
                      ...p,
                      allowedDirs: p.allowedDirs.includes(path) ? 
                        p.allowedDirs.filter(p => p !== path) : 
                        [...p.allowedDirs, path]
                    }
                  } else {
                    return p
                  }
                })
              }
            })
          }}
        />
      )}
    </div>
  )
}

export default EditPath
