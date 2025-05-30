import { ChangeEvent, Dispatch, SetStateAction } from "react"
import { settingsErrorType, settingsType } from "../types/settingsType"

export const inputLabel = <T extends Record<string, string | undefined>>(
  type: keyof T, // The field in formErr we're looking at
  formErr: T, // Entire err object
  customLabel?: string, // Rename the field
): string => {
  const key = type as string
  const sanatised = key.replace(/\./g, "_")
  const errorMessage = formErr[sanatised] ?? ""
  const label = String(sanatised)
    .replace(/_/g, " ")
    .replace(/^\w/, (c) => c.toUpperCase())

  return `${customLabel ? customLabel : label}${errorMessage ? `: ${errorMessage}` : ""}`
}

const setNestedValue = <T>(obj: T, path: string[], value: string): T => {
  if (path.length === 0) return obj

  const [key, ...rest] = path

  return {
    ...obj,
    [key]:
      rest.length > 0
        ? setNestedValue((obj as Record<string, unknown>)[key] ?? {}, rest, value)
        : value,
  } as T
}

// Update form with any errors it might have
export const updateInput = <T extends { [key: string]: string }>(
  e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  setForm: Dispatch<SetStateAction<settingsType>>,
  setFormErr: Dispatch<SetStateAction<T>>,
  noStateUpdate?: boolean,
): void => {
  const path = e.target.name.split(".")

  // Update nested form state
  if (!noStateUpdate) {
    setForm((prevForm): settingsType => {
      return setNestedValue(prevForm, path, e.target.value)
    })
  }

  const inputErr = (key: string, err?: string): void => {
    setFormErr(
      (prevFormErr): T => ({
        ...prevFormErr,
        [key.replace(/\./g, "_")]: err ?? "",
      }),
    )
  }

  // Match a general URL string
  // prettier-ignore
  const caseURL = () => {
    if (/^((https?|ftp):\/\/)?((localhost|(\d{1,3}\.){3}\d{1,3})|(([a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}))(:(\d+))?(\/[^\s]*)?$/.test(e.target.value) || e.target.value.trim() === "") {
      inputErr(e.target.name, "")
    } else {
      inputErr(e.target.name, "Invalid URL.")
    }
  }

  // Match a 32 length hex string
  const caseKEY = () => {
    if (/^[a-fA-F0-9]{32}$/.test(e.target.value) || e.target.value.trim() === "") {
      inputErr(e.target.name, "")
    } else {
      inputErr(e.target.name, "Invalid API KEY.")
    }
  }

  // Has to match any of the remove_missing_level options
  const caseRMLOptions = () => {
    if (e.target.value === "Library" || e.target.value === "Import List") {
      inputErr(e.target.name, "")
    } else {
      inputErr(e.target.name, "Must be one of the remove_missing_level options.")
    }
  }

  // Match valid chmod request. E.G 775
  const caseChmod = () => {
    if (/^[0-7]{3}$/.test(e.target.value) || e.target.value.trim() === "") {
      inputErr(e.target.name, "")
    } else {
      inputErr(e.target.name, "Must be three numbers.")
    }
  }

  const casePosix = () => {
    if (/^[a-zA-Z][a-zA-Z0-9_.-]{0,31}$/.test(e.target.value) || e.target.value.trim() === "") {
      inputErr(e.target.name, "")
    } else {
      inputErr(e.target.name, "Must meet the POSIX standard.")
    }
  }

  const caseToken = () => {
    if (/^[A-Za-z0-9-_=.]{20,}$/.test(e.target.value) || e.target.value.trim() === "") {
      inputErr(e.target.name, "")
    } else {
      inputErr(e.target.name, "Must be a valid API token.")
    }
  }

  const caseBytes = () => {
    if (
      /^([\d.]+)\s*(k|m|g|t|p|e|z|y)(b)?$/i.test(e.target.value) ||
      e.target.value.trim() === ""
    ) {
      inputErr(e.target.name, "")
    } else {
      inputErr(e.target.name, "Invalid. Examples: '100GB' or '1.5T'")
    }
  }

  // Depending on the current element do some basic validation checks.
  // prettier-ignore
  switch (true) {
    case e.target.name.includes("URL"): caseURL(); break
    case e.target.name.includes("KEY"): caseKEY(); break
    case e.target.name.includes("level"): caseRMLOptions(); break
    case e.target.name.includes("user"): casePosix(); break
    case e.target.name.includes("group"): casePosix(); break
    case e.target.name.includes("chmod"): caseChmod(); break
    case e.target.name.includes("token"): caseToken(); break
    case e.target.name.includes("space"): caseBytes(); break
    default: setFormErr(prevFormErr => prevFormErr)
  }
}

// A function to check that both user and group fields are not null on updateSettings
export const checkChownValidity = (
  user: string | null,
  group: string | null,
  setFormErr: Dispatch<SetStateAction<settingsErrorType>>,
): boolean => {
  const formErr = (msg: string) => {
    setFormErr((prevErrs) => {
      return {
        ...prevErrs,
        permissions_change_chown: msg,
      }
    })
  }

  if ((user && !group) || (!user && group)) {
    formErr("Both user and group must be populated.")
    return true
  }

  formErr("")
  return false
}
