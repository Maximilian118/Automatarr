// What was removed: a file or folder on disk, a library entry, a torrent, a queue item, or a single media file
export type ActivityAction = "file" | "folder" | "library" | "torrent" | "queue" | "movie_file" | "episode_file"

// One recorded removal
export interface ActivityItem {
  _id: string
  at: string
  source: string
  action: ActivityAction
  app: string | null
  title: string
  path: string | null
  bytes: number | null
  reason: string | null
}

// How many removals each source has made
export interface ActivitySource {
  source: string
  count: number
}

// One page of the activity history, newest first
export interface ActivityPage {
  items: ActivityItem[]
  next: string | null
  sources: ActivitySource[]
  tokens?: string[] | null
}
