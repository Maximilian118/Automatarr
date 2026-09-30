import { useEffect, useState } from "react"
import { LoopStatus } from "../../types/dashboardType"
import { getLoopStatus } from "../requests/dashboardRequests"
import { useAuthHandlers } from "./useAuthHandlers"

const REFRESH_MS = 60_000

// Loop run state keyed by loop name, refreshed quietly every minute
export const useLoopStatus = (): Record<string, LoopStatus> => {
  const auth = useAuthHandlers()
  const [statuses, setStatuses] = useState<Record<string, LoopStatus>>({})

  useEffect(() => {
    let cancelled = false

    // Fetch and index the loop statuses. Failures leave the previous values in place
    const load = async () => {
      try {
        const loops = await getLoopStatus(auth)
        if (!cancelled) setStatuses(Object.fromEntries(loops.map((l) => [l.name, l])))
      } catch {
        // Status is supplementary; the page works without it
      }
    }

    load()
    const timer = window.setInterval(load, REFRESH_MS)

    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [auth])

  return statuses
}
