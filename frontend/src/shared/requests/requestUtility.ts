import { NavigateFunction } from "react-router-dom"
import { UserType } from "../../types/userType"
import { Dispatch, SetStateAction } from "react"
import { logout } from "../localStorage"

// Boil an axios error down to one small string
export const getAxiosErrorMessage = (err: unknown): string => {
  if (!err || typeof err !== "object") return "Unknown error"

  // Axios-style error
  const axiosError = err as {
    response?: {
      data?: {
        errors?: { message?: string }[]
        message?: string
      }
      status?: number
      statusText?: string
    }
    message?: string
  }

  // GraphQL-style error inside response.data.errors
  if (axiosError.response?.data?.errors?.[0]?.message) {
    console.log()
    return axiosError.response.data.errors[0].message
  }

  // Fallback to a general message
  if (axiosError.response?.data?.message) {
    return axiosError.response.data.message
  }

  // Axios-level message
  if (axiosError.message) {
    return axiosError.message
  }

  return "An unexpected error occurred"
}

// Check if Unauthorised. If so, logout.
export const authCheck = (
  errors: { message?: string }[] | undefined,
  setUser: Dispatch<SetStateAction<UserType>>,
  navigate: NavigateFunction,
): void => {
  if (!Array.isArray(errors)) return

  for (const err of errors) {
    if (err.message === "Unauthorised") {
      console.error("Unauthorised access. Logging out.")
      logout(setUser, navigate)
      return
    }
  }
}

// Add headers to a request
export const headers = (
  token: string,
): {
  "Content-Type": string
  accessToken: string
  refreshToken: string
} => {
  const refreshToken = localStorage.getItem("refresh_token")

  return {
    "Content-Type": "application/json",
    accessToken: `Bearer ${token}`,
    refreshToken: `Bearer ${refreshToken}`,
  }
}

// Change all values in an formErr object to ""
export const clearErrors = <T extends Record<string, string | undefined>>(errObj: T): T =>
  Object.keys(errObj).reduce((acc, key) => {
    acc[key as keyof T] = "" as T[keyof T]
    return acc
  }, {} as T)

// Handle new tokens
export const handleResponseTokens = <T extends { tokens?: string[] }>(
  resObj: T,
  setUser: Dispatch<SetStateAction<UserType>>,
): T => {
  const tokens = resObj.tokens

  if (Array.isArray(tokens) && tokens.length === 2) {
    const [accessToken, refreshToken] = tokens

    localStorage.setItem("access_token", accessToken)
    localStorage.setItem("refresh_token", refreshToken)

    setUser((prev) => ({
      ...prev,
      token: accessToken,
    }))

    console.log("Tokens Refreshed!")
  }

  return resObj
}
