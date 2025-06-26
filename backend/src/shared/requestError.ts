import { AxiosError } from "axios"

export const axiosErrorMessage = (err: unknown): string => {
  if (!err || typeof err !== "object") return "Unknown error"

  const axiosError = err as AxiosError<any>

  const status = axiosError.response?.status
  const statusText = axiosError.response?.statusText
  const data = axiosError.response?.data
  const message = axiosError.message

  // If the response data is an array with errorMessage (e.g., Radarr-style)
  if (Array.isArray(data) && data[0]?.errorMessage) {
    return [
      status ? `Error ${status}${statusText ? ` ${statusText}` : ""}` : null,
      data[0].errorMessage,
    ]
      .filter(Boolean)
      .join(": ")
  }

  // GraphQL-style errors
  if (Array.isArray(data?.errors) && data.errors[0]?.message) {
    return [
      status ? `Error ${status}${statusText ? ` ${statusText}` : ""}` : null,
      data.errors[0].message,
    ]
      .filter(Boolean)
      .join(": ")
  }

  // Fallback to message from data
  if (data?.message) {
    return [status ? `Error ${status}${statusText ? ` ${statusText}` : ""}` : null, data.message]
      .filter(Boolean)
      .join(": ")
  }

  // Axios-level message
  return [status ? `Error ${status}${statusText ? ` ${statusText}` : ""}` : null, message]
    .filter(Boolean)
    .join(": ")
}
