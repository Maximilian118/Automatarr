import axios, { AxiosError } from "axios"

interface GraphQLErrorResponse {
  message?: string
  errors?: unknown[]
  [key: string]: any // Allow other props to prevent TS errors
}

export const errCodeAndMsg = (err: unknown): string => {
  try {
    // Check if it's an Axios error
    if (axios.isAxiosError(err)) {
      const axiosErr = err as AxiosError

      const status = axiosErr.response?.status ?? axiosErr.code ?? "Unknown Status"

      const data = axiosErr.response?.data as GraphQLErrorResponse | undefined

      const message =
        data?.message ?? axiosErr.message ?? axiosErr.response?.statusText ?? "Unknown Axios Error"

      const errors = data?.errors ?? []

      return `${status} - ${
        Array.isArray(errors) && errors.length !== 0 ? JSON.stringify(errors) : message
      }`
    }

    // Fallback: handle other unknown errors similarly
    const error = err as { response?: { status?: number; statusText?: string; data?: any } }
    const res = error?.response
    const status = res?.status ?? "Unknown Status"
    const data = res?.data as GraphQLErrorResponse | undefined
    const message = data?.message ?? res?.statusText ?? "Unknown Message"
    const errors = data?.errors ?? []

    return `${status} - ${
      Array.isArray(errors) && errors.length !== 0 ? JSON.stringify(errors) : message
    }`
  } catch {
    return "Unknown Error - Failed to extract error details."
  }
}
