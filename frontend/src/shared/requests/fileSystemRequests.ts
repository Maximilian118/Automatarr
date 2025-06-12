import axios from "axios"
import { Dispatch, SetStateAction } from "react"
import { authCheck, handleResponseTokens, headers } from "./requestUtility"
import { UserType } from "../../types/userType"
import { NavigateFunction } from "react-router-dom"

// Return an array of users from the OS the backend is running on
export const getUnixUsers = async (
  user: UserType,
  setUser: Dispatch<SetStateAction<UserType>>,
  navigate: NavigateFunction,
  setUnixUsers?: Dispatch<SetStateAction<string[]>>,
): Promise<string[]> => {
  try {
    const res = await axios.post(
      "",
      {
        query: `
        query {
          checkUnixUsers {
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
      console.error(`checkUnixUsers Error: ${res.data.errors[0].message}`)
    } else {
      handleResponseTokens(res.data.data.checkUnixUsers, setUser)
      const users = res.data.data.checkUnixUsers.data

      if (setUnixUsers) {
        setUnixUsers(users || ["Something went wrong."])
      }

      console.log(`checkUnixUsers: Users retrieved.`)
      return users
    }
  } catch (err) {
    console.error(`checkUnixUsers Error: ${err}`)
  }

  return []
}

// Return an array of groups from the OS the backend is running on
export const getUnixGroups = async (
  user: UserType,
  setUser: Dispatch<SetStateAction<UserType>>,
  navigate: NavigateFunction,
  setUnixGroups?: Dispatch<SetStateAction<string[]>>,
): Promise<string[]> => {
  try {
    const res = await axios.post(
      "",
      {
        query: `
          query {
            checkUnixGroups {
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
      console.error(`getUnixGroups Error: ${res.data.errors[0].message}`)
    } else {
      handleResponseTokens(res.data.data.checkUnixGroups, setUser)
      const groups = res.data.data.checkUnixGroups.data

      if (setUnixGroups) {
        setUnixGroups(groups || ["Something went wrong."])
      }

      console.log(`getUnixGroups: Groups retrieved.`)
      return groups
    }
  } catch (err) {
    console.error(`getUnixGroups Error: ${err}`)
  }

  return []
}

// Return an array of path strings
export const getChildPaths = async (
  path: string | null,
  setChildren: Dispatch<SetStateAction<string[]>>,
  setLoading: Dispatch<SetStateAction<boolean>>,
  user: UserType,
  setUser: Dispatch<SetStateAction<UserType>>,
  navigate: NavigateFunction,
): Promise<string[]> => {
  setLoading(true)

  try {
    const res = await axios.post(
      "",
      {
        variables: {
          path,
        },
        query: `
        query GetChildPaths( $path: String ) {
          getChildPaths( path: $path ) {
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
      console.error(`getChildPaths Error: ${res.data.errors[0].message}`)
      return []
    } else {
      handleResponseTokens(res.data.data.getChildPaths, setUser)
      const children = res.data.data.getChildPaths.data
      setChildren(children)
      console.log(`getChildPaths: Path children for retrieved for ${path ? path : "/"}`)
      return children
    }
  } catch (err) {
    console.error(`getChildPaths Error: ${err}`)
    return []
  } finally {
    setLoading(false)
  }
}
