// SABnzbd job priorities as the API accepts them. 2 = Force, 1 = High, 0 = Normal, -1 = Low.
export type SABnzbdPriority = 2 | 1 | 0 | -1

// A single job in the SABnzbd download queue
export type SABnzbdSlot = {
  nzo_id: string // Unique job ID. Radarr/Sonarr store this as the queue item's downloadId
  filename: string // The job's name
  status: string // Downloading, Queued, Paused, Grabbing, Propagating etc
  priority: SABnzbdPriority // The job's priority group
  index: number // Position in the queue, starting at 0
  percentage: number // How much of the job has downloaded, 0 to 100
  timeleft: string // SABnzbd's estimate of when the job finishes, e.g. "0:20:15". Includes jobs ahead of it
  mbleft: number // Megabytes still to download
}

// The SABnzbd queue: its jobs in order, and whether the whole queue is paused
export type SABnzbdQueue = {
  paused: boolean
  slots: SABnzbdSlot[]
}
