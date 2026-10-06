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

// The live download speed and limit SABnzbd reports in its queue. All speeds are bytes per second.
export type SABnzbdSpeedState = {
  paused: boolean // The whole queue is paused, including a pause for post-processing
  status: string // "Downloading", "Paused" or "Idle"
  jobs: number // Jobs in the queue
  speed: number // Current download speed
  limit: number // Active speed limit. 0 = no limit
}

// The SABnzbd settings that control its speed limit and when it changes
export type SABnzbdMiscConfig = {
  bandwidth_max: number // "Maximum line speed" in bytes per second. 0 = not set
  bandwidth_perc: number // "Percentage of line speed" from 0 to 100. 0 = no limit
  schedlines: string[] // Scheduled tasks, e.g. "1 0 8 1234567 speedlimit 50". The first digit is 1 when enabled
}
