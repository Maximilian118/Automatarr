// One log entry. Multi-line messages (stack traces) arrive joined with "\n"
export interface LogEntry {
  id: string // Cursor of the entry's first byte: "DD-MM-YYYY:byteOffset"
  timestamp: string
  level: string
  message: string
}

// A page of entries in chronological order with cursors to continue in either direction
export interface LogPage {
  entries: LogEntry[]
  before: string | null // Pass as ?before= for older entries. Null when nothing older exists
  after: string // Pass as ?after= for newer entries, or as the stream's starting point
  tokens?: string[]
}
