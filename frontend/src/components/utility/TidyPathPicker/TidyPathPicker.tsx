import React, { Dispatch, SetStateAction, useEffect, useState } from "react"
import './tidyPathPicker.scss'
import { settingsErrorType, settingsType, tidyPaths } from "../../../types/settingsType"
import MUIAutocomplete from "../MUIAutocomplete/MUIAutocomplete"
import { getChildPaths } from "../../../shared/requests/fileSystemRequests"
import TidyPath from "./TidyPath/TidyPath"
import { Add, ArrowLeft, CheckBox, Clear } from "@mui/icons-material"
import EditPath from "./EditPath/EditPath"
import { shortPath } from "../../../shared/utility"
import { CircularProgress, IconButton } from "@mui/material"
import { UserType } from "../../../types/userType"
import { NavigateFunction } from "react-router-dom"

interface TidyPathPickerType {
  label: string
  paths: tidyPaths[]
  setSettings: Dispatch<SetStateAction<settingsType>>
  setFormErr: Dispatch<SetStateAction<settingsErrorType>>
  user: UserType,
  setUser: Dispatch<SetStateAction<UserType>>,
  navigate: NavigateFunction,
  disabled?: boolean
  error?: boolean
}

const TidyPathPicker: React.FC<TidyPathPickerType> = ({ 
  label, 
  paths,
  setSettings,
  setFormErr, 
  user,
  setUser,
  navigate,
  disabled,
  error, 
}) => {
  const [ value, setValue ] = useState<string | null>(null) // Value of the autocomplete input
  const [ children, setChildren ] = useState<string[]>([]) // Children of the current value/path in the host fs
  const [ loading, setLoading ] = useState<boolean>(false)
  const [ editPath, setEditPath ] = useState<tidyPaths | null>(null) // If we've selected a path, open edit view and use this tidyPath data
  
  // With every new path, retrieve the paths children
  useEffect(() => {
    if (!disabled && !editPath) {
      getChildPaths(value, setChildren, setLoading, user, setUser, navigate)
    }
  }, [value, disabled, paths, editPath, user, setUser, navigate])

  // Check if any tidyPaths have empty allowedDir arrays
  useEffect(() => {
    const someEmpty = paths.some(p => p.allowedDirs.length === 0) && !editPath

    setFormErr(prevFormErr => {
      return {
        ...prevFormErr,
        tidy_directories: someEmpty ? "At least one." : ""
      }
    })
  }, [paths, setFormErr, editPath])

  // Add a path to the currentPaths and open the edit view of the path as to have no allowed dirs is invalid
  const addPathHandler = (option: string): void => {
    const newPath = {
      path: option,
      allowedDirs: [],
    }

    setSettings(prevSettings => {
      return {
        ...prevSettings,
        tidy_directories_paths: [
          newPath,
          ...prevSettings.tidy_directories_paths,
        ]
      }
    })

    setEditPath(newPath)
  }

  // Remove path from currentPaths array and return to default view
  const deletePathHandler = (path: string): void => {
    setSettings(prevSettings => {
      return {
        ...prevSettings,
        tidy_directories_paths: prevSettings.tidy_directories_paths.filter(p => p.path !== path)
      }
    })

    setEditPath(null)
  }

  // A back button for edit view
  const backBtn = (
    <div 
      className="tidy-path-picker-back"
      onClick={() => setEditPath(null)}
    >
      <ArrowLeft/>
      <p>Back</p>
    </div>
  )

  // A demo of what the tick boxes mean
  const tickedDemo = (
    <div className="ticked-path-demo">
      <CheckBox/>
      <p>= Allowed</p>
    </div>
  )

  // An add button
  const addbtn = (
    <IconButton className="edit-path-add" size="small">
      <Add/>
    </IconButton>
  )

  // A delete button
  const deleteBtn = (
    <IconButton 
      className="edit-path-delete" 
      size="small" 
      color="error"
      onClick={() => editPath && deletePathHandler(editPath.path)}
    >
      <Clear/>
    </IconButton>
  )

  // If loading in edit view, display spinner, if not, display delete btn
  const editAdornment = () => {
    if (loading && editPath) {
      return (
        <div style={{ height: 20, margin: "0 7px 0 4px" }}>
          <CircularProgress size={20}/>
        </div>
      )
    }

    return deleteBtn
  }

  return (
    <div className={`tidy-path-picker${error ? " tidy-error" : ""}${disabled ? " tidy-disabled" : ""}${editPath ? " edit-path-autocomplete" : ""}`}>
      <MUIAutocomplete
        name="tidy_directories"
        label={editPath ? `Allowed for ${shortPath(editPath.path)}` : label}
        value={value}
        setValue={setValue}
        options={children.filter((c) => !paths.some((p) => c === p.path))}
        size="small"
        disabled={disabled || !!editPath}
        error={error}
        startAdornment={editPath ? backBtn : undefined}
        endAdornment={editPath ? <>{tickedDemo}{editAdornment()}</> : undefined}
        optionsEndAdornment={addbtn}
        optionsEndAdornmentOnClick={(option) => addPathHandler(option)}
        noInteract={!!editPath}
        loading={loading && !editPath}
      />
      {editPath ? 
        <EditPath 
          editPath={editPath}
          value={value}
          setValue={setValue}
          user={user}
          setUser={setUser}
          setSettings={setSettings}
          setLoading={setLoading}
          path={paths.find(p => p.path === editPath.path)}
          disabled={disabled}
        /> : 
        <div className="tidy-path-paths">
          {paths.map((p, i) => 
            <TidyPath 
              key={i} 
              path={p.path}
              disabled={disabled}
              error={p.allowedDirs.length === 0}
              onClick={() => setEditPath({
                path: p.path,
                allowedDirs: p.allowedDirs,
              })}
            />
          )}
        </div>
      }
    </div>
  )
}

export default TidyPathPicker
