import axios from "axios"
import { Dispatch, SetStateAction } from "react"
import { NavigateFunction } from "react-router-dom"
import { UserType } from "../../types/userType"
import { authCheck, handleResponseTokens, headers } from "./requestUtility"

export interface AuthHandlers {
  setUser: Dispatch<SetStateAction<UserType>>
  navigate: NavigateFunction
}

// Send a GraphQL query with the stored tokens and return the named field.
// Logs out on "Unauthorised", stores refreshed tokens, and throws on any other GraphQL error.
export const graphqlRequest = async <T extends { tokens?: string[] | null }>(
  field: string,
  query: string,
  variables: Record<string, unknown> | undefined,
  auth: AuthHandlers,
): Promise<T> => {
  const token = localStorage.getItem("access_token")
  const res = await axios.post("", { query, variables }, { headers: headers(token || "") })

  if (res.data.errors) {
    authCheck(res.data.errors, auth.setUser, auth.navigate)
    throw new Error(res.data.errors[0]?.message || `${field} failed`)
  }

  const result = res.data.data[field] as T
  handleResponseTokens({ tokens: result.tokens ?? undefined }, auth.setUser)
  return result
}
