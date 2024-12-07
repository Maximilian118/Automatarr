// Graphql err type
export interface graphqlErr {
  response: {
    status: number
    statusText: string
    headers: object
    config: object
    request: object
    data: {
      message: string
      content: string
      type?: string // if it's an error from the Starr App
      title?: string // if it's an error from the Starr App
      status?: number // if it's an error from the Starr App
      traceId?: string // if it's an error from the Starr App
      errors?: Record<string, string[]> // if it's an error from the Starr App
    }
  }
}
