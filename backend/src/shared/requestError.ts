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

      const method = axiosErr.config?.method?.toUpperCase()
      const url = axiosErr.config?.url
      const status = axiosErr.response?.status ?? axiosErr.code ?? "Unknown Status"
      const statusText = axiosErr.response?.statusText ?? ""
      const responseData = axiosErr.response?.data
      const requestData = axiosErr.config?.data

      const data = responseData as GraphQLErrorResponse | undefined
      const message = (data?.message ?? axiosErr.message ?? statusText) || "Unknown Axios Error"

      const errors = data?.errors
      const combinedErrors =
        Array.isArray(errors) && errors.length > 0 ? JSON.stringify(errors, null, 2) : null

      return [
        `Axios Error: ${status} ${statusText}`,
        method && url ? `→ ${method} ${url}` : null,
        requestData ? `Request Data: ${JSON.stringify(requestData, null, 2)}` : null,
        combinedErrors ? `Errors: ${combinedErrors}` : `Message: ${message}`,
      ]
        .filter(Boolean)
        .join("\n")
    }

    // Fallback for unknown or non-Axios errors
    const error = err as {
      response?: { status?: number; statusText?: string; data?: any }
      message?: string
      stack?: string
    }

    const res = error?.response
    const status = res?.status ?? "Unknown Status"
    const statusText = res?.statusText ?? ""
    const data = res?.data as GraphQLErrorResponse | undefined
    const message = data?.message ?? error.message ?? "Unknown Message"
    const errors = data?.errors
    const combinedErrors =
      Array.isArray(errors) && errors.length > 0 ? JSON.stringify(errors, null, 2) : null

    return [
      `Error: ${status} ${statusText}`,
      combinedErrors ? `Errors: ${combinedErrors}` : `Message: ${message}`,
      error.stack ? `Stack: ${error.stack}` : null,
    ]
      .filter(Boolean)
      .join("\n")
  } catch (e) {
    return `Unknown Error - Failed to extract error details.\n${(e as Error).message}`
  }
}
