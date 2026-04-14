import axios from "axios"
import { Dispatch, SetStateAction } from "react"
import { NavigateFunction } from "react-router-dom"
import { ImportList, ImportListApiStats, ImportListCreateInput, ImportListUpdateInput, RootFolderPaths } from "../../types/importListType"
import { UserType } from "../../types/userType"
import { authCheck, getAxiosErrorMessage, handleResponseTokens, headers } from "./requestUtility"

// GraphQL fields to select for import list data
const populateImportList = `
  name
  data {
    id
    enabled
    enableAuto
    monitor
    searchOnAdd
    minimumAvailability
    enableAutomaticAdd
    searchForMissingEpisodes
    shouldMonitor
    monitorNewItems
    seriesType
    seasonFolder
    rootFolderPath
    qualityProfileId
    listType
    listOrder
    minRefreshInterval
    name
    fields {
      order
      name
      label
      helpText
      value
      type
      advanced
      privacy
      isFloat
    }
    implementationName
    implementation
    configContract
    infoLink
    tags
  }
`

// Fetch all import lists from all active APIs
export const getImportLists = async (
  setImportLists: Dispatch<SetStateAction<ImportList[]>>,
  setLoading: Dispatch<SetStateAction<boolean>>,
  user: UserType,
  setUser: Dispatch<SetStateAction<UserType>>,
  navigate: NavigateFunction,
): Promise<void> => {
  setLoading(true)

  try {
    const res = await axios.post(
      "",
      {
        query: `
          query {
            getImportLists {
              data {
                ${populateImportList}
              }
              tokens
            }
          }
        `,
      },
      { headers: headers(user.token) },
    )

    if (res.data.errors) {
      authCheck(res.data.errors, setUser, navigate)
      console.error(`getImportLists Error: ${res.data.errors[0].message}`)
    } else {
      handleResponseTokens(res.data.data.getImportLists, setUser)
      setImportLists(res.data.data.getImportLists.data as ImportList[])
      console.log("getImportLists: Import lists retrieved.")
    }
  } catch (err) {
    console.error(getAxiosErrorMessage(err))
  } finally {
    setLoading(false)
  }
}

// Fetch all root folder paths from all active APIs
export const getRootFolderPaths = async (
  setRootFolderPaths: Dispatch<SetStateAction<RootFolderPaths[]>>,
  user: UserType,
  setUser: Dispatch<SetStateAction<UserType>>,
  navigate: NavigateFunction,
): Promise<void> => {
  try {
    const res = await axios.post(
      "",
      {
        query: `
          query {
            getRootFolderPaths {
              data {
                name
                paths
              }
              tokens
            }
          }
        `,
      },
      { headers: headers(user.token) },
    )

    if (res.data.errors) {
      authCheck(res.data.errors, setUser, navigate)
      console.error(`getRootFolderPaths Error: ${res.data.errors[0].message}`)
    } else {
      handleResponseTokens(res.data.data.getRootFolderPaths, setUser)
      setRootFolderPaths(res.data.data.getRootFolderPaths.data as RootFolderPaths[])
      console.log("getRootFolderPaths: Root folder paths retrieved.")
    }
  } catch (err) {
    console.error(getAxiosErrorMessage(err))
  }
}

// Create a new import list on a specific API
export const createImportList = async (
  input: ImportListCreateInput,
  user: UserType,
  setUser: Dispatch<SetStateAction<UserType>>,
  navigate: NavigateFunction,
): Promise<boolean> => {
  try {
    const res = await axios.post(
      "",
      {
        variables: { input },
        query: `
          mutation CreateImportList($input: ImportListCreateInput!) {
            createImportList(input: $input) {
              success
              tokens
            }
          }
        `,
      },
      { headers: headers(user.token) },
    )

    if (res.data.errors) {
      authCheck(res.data.errors, setUser, navigate)
      console.error(`createImportList Error: ${res.data.errors[0].message}`)
      return false
    } else {
      handleResponseTokens(res.data.data.createImportList, setUser)
      console.log("createImportList: Import list created.")
      return true
    }
  } catch (err) {
    console.error(getAxiosErrorMessage(err))
    return false
  }
}

// Update an existing import list on a specific API
export const updateImportList = async (
  input: ImportListUpdateInput,
  user: UserType,
  setUser: Dispatch<SetStateAction<UserType>>,
  navigate: NavigateFunction,
): Promise<boolean> => {
  try {
    const res = await axios.post(
      "",
      {
        variables: { input },
        query: `
          mutation UpdateImportList($input: ImportListUpdateInput!) {
            updateImportList(input: $input) {
              success
              tokens
            }
          }
        `,
      },
      { headers: headers(user.token) },
    )

    if (res.data.errors) {
      authCheck(res.data.errors, setUser, navigate)
      console.error(`updateImportList Error: ${res.data.errors[0].message}`)
      return false
    } else {
      handleResponseTokens(res.data.data.updateImportList, setUser)
      console.log("updateImportList: Import list updated.")
      return true
    }
  } catch (err) {
    console.error(getAxiosErrorMessage(err))
    return false
  }
}

// Delete an import list from a specific API
export const deleteImportList = async (
  apiName: string,
  id: number,
  user: UserType,
  setUser: Dispatch<SetStateAction<UserType>>,
  navigate: NavigateFunction,
): Promise<boolean> => {
  try {
    const res = await axios.post(
      "",
      {
        variables: { input: { apiName, id } },
        query: `
          mutation DeleteImportList($input: ImportListDeleteInput!) {
            deleteImportList(input: $input) {
              success
              tokens
            }
          }
        `,
      },
      { headers: headers(user.token) },
    )

    if (res.data.errors) {
      authCheck(res.data.errors, setUser, navigate)
      console.error(`deleteImportList Error: ${res.data.errors[0].message}`)
      return false
    } else {
      handleResponseTokens(res.data.data.deleteImportList, setUser)
      console.log("deleteImportList: Import list deleted.")
      return true
    }
  } catch (err) {
    console.error(getAxiosErrorMessage(err))
    return false
  }
}

// Fetch per-list stats (downloaded/downloading/missing) from all active APIs
export const getImportListStats = async (
  setStats: Dispatch<SetStateAction<ImportListApiStats[]>>,
  user: UserType,
  setUser: Dispatch<SetStateAction<UserType>>,
  navigate: NavigateFunction,
): Promise<void> => {
  try {
    const res = await axios.post(
      "",
      {
        query: `
          query {
            getImportListStats {
              data {
                name
                stats {
                  listId
                  total
                  downloaded
                  downloading
                  missing
                  sizeOnDisk
                  error
                  errorMessage
                }
              }
              tokens
            }
          }
        `,
      },
      { headers: headers(user.token) },
    )

    if (res.data.errors) {
      authCheck(res.data.errors, setUser, navigate)
      console.error(`getImportListStats Error: ${res.data.errors[0].message}`)
    } else {
      handleResponseTokens(res.data.data.getImportListStats, setUser)
      setStats(res.data.data.getImportListStats.data as ImportListApiStats[])
      console.log("getImportListStats: Stats retrieved.")
    }
  } catch (err) {
    console.error(getAxiosErrorMessage(err))
  }
}

// Test an import list configuration against a specific API
export const testImportList = async (
  input: ImportListCreateInput & { id?: number },
  user: UserType,
  setUser: Dispatch<SetStateAction<UserType>>,
  navigate: NavigateFunction,
): Promise<boolean> => {
  try {
    const res = await axios.post(
      "",
      {
        variables: { input },
        query: `
          mutation TestImportList($input: ImportListTestInput!) {
            testImportList(input: $input) {
              success
              tokens
            }
          }
        `,
      },
      { headers: headers(user.token) },
    )

    if (res.data.errors) {
      authCheck(res.data.errors, setUser, navigate)
      console.error(`testImportList Error: ${res.data.errors[0].message}`)
      return false
    } else {
      handleResponseTokens(res.data.data.testImportList, setUser)
      return res.data.data.testImportList.success
    }
  } catch (err) {
    console.error(getAxiosErrorMessage(err))
    return false
  }
}
