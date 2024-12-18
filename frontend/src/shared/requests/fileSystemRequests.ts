import axios from "axios"
import { Dispatch, SetStateAction } from "react"

// Return an array of users from the OS the backend is running on
export const getUsers = async (
  setUsers?: Dispatch<SetStateAction<string[]>>,
): Promise<string[]> => {
  try {
    const res = await axios.post("", {
      query: `
        query {
          checkUsers
        }
      `,
    })

    if (res.data.errors) {
      console.error(`getUsers Error: ${res.data.errors[0].message}`)
      return []
    } else {
      console.log(`getUsers: Users retrieved.`)
      const users = res.data.data.checkUsers

      if (setUsers) {
        setUsers(users)
      }

      return users
    }
  } catch (err) {
    console.error(`getUsers Error: ${err}`)
    return []
  }
}

// Return an array of groups from the OS the backend is running on
export const getGroups = async (
  setGroups?: Dispatch<SetStateAction<string[]>>,
): Promise<string[]> => {
  try {
    const res = await axios.post("", {
      query: `
        query {
          checkGroups
        }
      `,
    })

    if (res.data.errors) {
      console.error(`getGroups Error: ${res.data.errors[0].message}`)
      return []
    } else {
      console.log(`getGroups: Groups retrieved.`)
      const groups = res.data.data.checkGroups

      if (setGroups) {
        setGroups(groups)
      }

      return groups
    }
  } catch (err) {
    console.error(`getGroups Error: ${err}`)
    return []
  }
}

// Return an array of path strings
export const getChildPaths = async (
  path: string | null,
  setChildren: Dispatch<SetStateAction<string[]>>,
  setLoading: Dispatch<SetStateAction<boolean>>,
): Promise<string[]> => {
  setLoading(true)

  try {
    const res = await axios.post("", {
      variables: {
        path,
      },
      query: `
        query GetChildPaths( $path: String ) {
          getChildPaths( path: $path )
        }
      `,
    })

    if (res.data.errors) {
      console.error(`getChildPaths Error: ${res.data.errors[0].message}`)
      return []
    } else {
      console.log(`getChildPaths: Path children for retrieved for ${path ? path : "/"}`)
      const children = res.data.data.getChildPaths
      setChildren(children)
      return children
    }
  } catch (err) {
    console.error(`getChildPaths Error: ${err}`)
    return []
  } finally {
    setLoading(false)
  }
}
