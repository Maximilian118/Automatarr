import { PriorityContentType } from "../models/downloadPriority"

// Who a new download has to wait for, and whose series it jumped ahead of.
// Each is a ready-to-read description such as "Dave's *Dune*", or null when there's nobody.
export type QueueConflict = {
  ahead: string | null
  bumped: string | null
}

// Another user's download as it should be described to the requester
export type QueueEntryDescription = {
  name: string
  title: string
  content_type: PriorityContentType
  private: boolean // Their bot-memory privacy preference. Hides their name and title
}

// A single change to make to the SABnzbd queue
export type SABnzbdMove =
  | { type: "priority"; nzoId: string } // Promote the job to High priority
  | { type: "switch"; nzoId: string; targetNzoId: string } // Move the job directly above the target
