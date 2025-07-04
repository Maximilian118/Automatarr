import { Dispatch, SetStateAction } from "react"
import { UserType } from "../../types/userType"
import { NavigateFunction } from "react-router-dom"
import axios from "axios"
import { authCheck, handleResponseTokens, headers } from "./requestUtility"

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
    console.error(`getBackupFiles Error: ${err}`)
  }

  setLoading(false)
  return []
}
