import { ChangeEvent, Dispatch, SetStateAction } from "react"
import { settingsErrorType, settingsType } from "./types"

export const inputLabel = (type: keyof settingsErrorType, formErr: settingsErrorType): string => {
  const errorMessage = formErr[type]
  const label = type.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase())

  return `${label}${errorMessage && `: ${errorMessage}`}`
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
      /^(http:\/\/)?(localhost|(\d{1,3}\.){3}\d{1,3}):\d{1,5}(\/)?$/.test(e.target.value) ||
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

  // Depending on the current element do some basic validation checks.
  // prettier-ignore
  switch (true) {
    case e.target.name.includes("URL"): caseURL(); break
    case e.target.name.includes("KEY"): caseKEY(); break
    default: setFormErr(prevFormErr => prevFormErr)
  }
}
