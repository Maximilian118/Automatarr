import { Dispatch, SetStateAction } from "react"
import { UserType } from "../../types/userType"
import { NavigateFunction } from "react-router-dom"
import axios from "axios"
import { authCheck, getAxiosErrorMessage, handleResponseTokens, headers } from "./requestUtility"
import { populateSettings } from "./requestPopulation"
import { settingsType } from "../../types/settingsType"

// Return an array of backup file names
export const getBackupFiles = async (
  user: UserType,
  setUser: Dispatch<SetStateAction<UserType>>,
  navigate: NavigateFunction,
  setLoading: Dispatch<SetStateAction<boolean>>,
): Promise<string[]> => {
  setLoading(true)

  try {
    const res = await axios.post(
      "",
      {
        query: `
          query {
            getBackupFiles {
              data
              tokens
            }
          }
        `,
      },
      { headers: headers(user.token) },
    )

    if (res.data.errors) {
      authCheck(res.data.errors, setUser, navigate)
      console.error(`getBackupFiles Error: ${res.data.errors[0].message}`)
    } else {
      handleResponseTokens(res.data.data.getBackupFiles, setUser)
      console.log(`getBackupFiles: Backup file names retrieved.`)
      setLoading(false)
      return res.data.data.getBackupFiles.data
    }
  } catch (err) {
    console.error(getAxiosErrorMessage(err))
  }

  setLoading(false)
  return []
}

// Return an array of backup file names
export const getBackupFile = async (
  user: UserType,
  setUser: Dispatch<SetStateAction<UserType>>,
  navigate: NavigateFunction,
  setLoading: Dispatch<SetStateAction<boolean>>,
  fileName: string,
  setBackupFileName: Dispatch<SetStateAction<string | null>>,
  setSettings: Dispatch<SetStateAction<settingsType>>,
  setErr: Dispatch<SetStateAction<string>>,
  setBackupBtnClicked: Dispatch<SetStateAction<boolean>>,
): Promise<settingsType | undefined> => {
  setLoading(true)

  try {
    const res = await axios.post(
      "",
      {
        variables: {
          fileName,
        },
        query: `
          query GetBackupFile($fileName: String!) {
            getBackupFile(fileName: $fileName) {
              ${populateSettings}
            }
          }
        `,
      },
      { headers: headers(user.token) },
    )

    if (res.data.errors) {
      authCheck(res.data.errors, setUser, navigate)
      console.error(`getBackupFile Error: ${res.data.errors[0].message}`)
    } else {
      const settings = handleResponseTokens(res.data.data.getBackupFile, setUser) as settingsType

      setSettings((prevSettings) => {
        return {
          ...prevSettings,
          ...settings,
        }
      })

      console.log(`getBackupFile: Backup file retrieved.`)
      setBackupFileName(null)
      setBackupBtnClicked(false)
      setLoading(false)
      return settings
    }
  } catch (err) {
    console.error(getAxiosErrorMessage(err))
  }

  setErr(() => "Unexpected Error")
  setLoading(false)
  return
}
