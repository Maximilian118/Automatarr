// Run state of one automation loop
export interface LoopStatus {
  name: string
  active: boolean
  running: boolean
  interval_mins: number | null
  first_ran: string | null
  last_ran: string | null
  next_run: string | null
  deletions_24h: number
}

export interface LoopStatusResult {
  loops: LoopStatus[]
  tokens?: string[] | null
}

// A title that recently became watchable
export interface Arrival {
  type: "movie" | "series"
  title: string
  year: number | null
  poster: string | null
  added: string
  tmdbId: number | null
}

export interface RecentArrivalsResult {
  items: Arrival[]
  tokens?: string[] | null
}
