import { Dispatch, SetStateAction, useCallback, useEffect, useState } from "react"
import { NetworkStatus } from "../../types/networkType"
import { getNetworkStatus } from "../requests/networkRequests"
import { useAuthHandlers } from "./useAuthHandlers"

const REFRESH_MS = 10_000 // Matches how often the balancer runs

interface NetworkStatusState {
  status: NetworkStatus | null
  setStatus: Dispatch<SetStateAction<NetworkStatus | null>>
  error: string
  refresh: () => Promise<void>
}

// The Network page's live status, refreshed every 10 seconds while the tab is visible
export const useNetworkStatus = (): NetworkStatusState => {
  const auth = useAuthHandlers()
  const [status, setStatus] = useState<NetworkStatus | null>(null)
  const [error, setError] = useState<string>("")

  // Fetch the latest status. A failure keeps the last status on screen and shows why
  const refresh = useCallback(async () => {
    try {
      setStatus(await getNetworkStatus(auth))
      setError("")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't load the network status")
    }
  }, [auth])

  useEffect(() => {
    refresh()

    const timer = window.setInterval(() => {
      if (!document.hidden) refresh()
    }, REFRESH_MS)

    return () => window.clearInterval(timer)
  }, [refresh])

  return { status, setStatus, error, refresh }
}
