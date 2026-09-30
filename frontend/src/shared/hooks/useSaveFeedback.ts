import { useCallback, useEffect, useRef, useState } from "react"
import { useToast } from "../toast/useToast"

export type SaveStatus = "idle" | "saving" | "saved" | "failed"

interface PendingSave {
  from: unknown
  sawLoading: boolean
}

interface SaveFeedback {
  status: SaveStatus
  savedAt: Date | null
  beginSave: (valid?: boolean) => void
}

// Reports the outcome of saves whose request helpers only log to the console.
// A save succeeded when `marker` (the saved object) is replaced once loading has started and finished;
// if loading finishes and the marker is unchanged, the save failed.
export const useSaveFeedback = (marker: unknown, loading: boolean, subject: string): SaveFeedback => {
  const { showToast } = useToast()
  const pending = useRef<PendingSave | null>(null)
  const [status, setStatus] = useState<SaveStatus>("idle")
  const [savedAt, setSavedAt] = useState<Date | null>(null)

  // Call right before triggering the save. Pass valid=false when the form has errors so nothing is sent
  const beginSave = useCallback(
    (valid: boolean = true) => {
      if (!valid) {
        pending.current = null
        setStatus("failed")
        showToast({
          tone: "error",
          title: `${subject} not saved`,
          message: "Fix the highlighted fields and try again.",
        })
        return
      }

      pending.current = { from: marker, sawLoading: false }
      setStatus("saving")
    },
    [marker, showToast, subject],
  )

  // Resolve the pending save once loading has come and gone
  useEffect(() => {
    const current = pending.current
    if (!current) return

    if (loading) {
      current.sawLoading = true
      return
    }

    if (!current.sawLoading) return
    pending.current = null

    if (marker !== current.from) {
      setStatus("saved")
      setSavedAt(new Date())
      showToast({ tone: "success", title: `${subject} saved` })
    } else {
      setStatus("failed")
      showToast({
        tone: "error",
        title: `${subject} not saved`,
        message: "Something went wrong while saving. The Logs page has the details.",
      })
    }
  }, [loading, marker, showToast, subject])

  return { status, savedAt, beginSave }
}
