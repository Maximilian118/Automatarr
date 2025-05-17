import { ChangeEvent, Dispatch, SetStateAction } from "react"
import { settingsErrorType, settingsType } from "../types/settingsType"

export const inputLabel = (
  type: keyof settingsErrorType,
  formErr: settingsErrorType,
  customLabel?: string,
): string => {
  const errorMessage = formErr[type] ? formErr[type] : ""
  const label = type.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase())

  return `${customLabel ? customLabel : label}${errorMessage && `: ${errorMessage}`}`
}

// Set the value of the passed key depending on if it has an error or not
const inputErr = (
  key: string,
  setFormErr: Dispatch<SetStateAction<settingsErrorType>>,
  err?: string,
): void => {
  setFormErr((prevFormErr): settingsErrorType => {
    return {
      ...prevFormErr,
      [key]: err ? err : "",
    }
  })
}

// Update form with any errors it might have
export const updateInput = (
  e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  setForm: Dispatch<SetStateAction<settingsType>>,
  setFormErr: Dispatch<SetStateAction<settingsErrorType>>,
): void => {
  // On every keystroke mutate form.
  setForm((prevForm): settingsType => {
    return {
      ...prevForm,
      [e.target.name]: e.target.value,
    }
  })

  // Match a general URL string
  const caseURL = () => {
    if (
      /^((https?|ftp):\/\/)?((localhost|(\d{1,3}\.){3}\d{1,3})|(([a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}))(:(\d+))?(\/[^\s]*)?$/.test(
        e.target.value,
      ) ||
      e.target.value.trim() === ""
    ) {
      inputErr(e.target.name, setFormErr, "")
    } else {
      inputErr(e.target.name, setFormErr, "Invalid URL.")
    }
  }

  // Match a 32 length hex string
  const caseKEY = () => {
    if (/^[a-fA-F0-9]{32}$/.test(e.target.value) || e.target.value.trim() === "") {
      inputErr(e.target.name, setFormErr, "")
    } else {
      inputErr(e.target.name, setFormErr, "Invalid API KEY.")
    }
  }

  // Has to match any of the remove_missing_level options
  const caseRMLOptions = () => {
    if (e.target.value === "Library" || e.target.value === "Import List") {
      inputErr(e.target.name, setFormErr, "")
    } else {
      inputErr(e.target.name, setFormErr, "Must be one of the remove_missing_level options.")
    }
  }

  // Match valid chmod request. E.G 775
  const caseChmod = () => {
    if (/^[0-7]{3}$/.test(e.target.value) || e.target.value.trim() === "") {
      inputErr(e.target.name, setFormErr, "")
    } else {
      inputErr(e.target.name, setFormErr, "Must be three numbers.")
    }
  }

  const casePosix = () => {
    if (/^[a-zA-Z][a-zA-Z0-9_.-]{0,31}$/.test(e.target.value) || e.target.value.trim() === "") {
      inputErr(e.target.name, setFormErr, "")
    } else {
      inputErr(e.target.name, setFormErr, "Must meet the POSIX standard.")
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
