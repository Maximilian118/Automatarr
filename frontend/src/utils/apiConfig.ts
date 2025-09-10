// Get the appropriate API base URL based on how the frontend is accessed
export const getApiBaseUrl = (): string => {
  const isLocalhost = window.location.hostname === "localhost"
  const isDomain = /^[a-zA-Z.-]+$/.test(window.location.hostname) // crude domain check
  const isIP = /^\d+\.\d+\.\d+\.\d+$/.test(window.location.hostname)

  if (isLocalhost || isDomain) {
    // Development (localhost) or Production with NGINX & domain proxying
    return ""
  } else if (isIP) {
    // Access via LAN IP: use the same IP but port 8091
    return `http://${window.location.hostname}:8091`
  } else {
    console.warn("Unknown frontend access pattern. Falling back to relative URLs.")
    return ""
  }
}