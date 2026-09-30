// SABnzbd job priorities as the API accepts them. 2 = Force, 1 = High, 0 = Normal, -1 = Low.
export type SABnzbdPriority = 2 | 1 | 0 | -1

// A single job in the SABnzbd download queue
export type SABnzbdSlot = {
  nzo_id: string // Unique job ID. Radarr/Sonarr store this as the queue item's downloadId
  filename: string // The job's name
  status: string // Downloading, Queued, Paused, Grabbing, Propagating etc
  priority: SABnzbdPriority // The job's priority group
}
