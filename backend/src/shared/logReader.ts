import fs from "fs"
import path from "path"
import moment from "moment"

// One log message. Multi-line messages (e.g. stack traces) are joined into a single entry.
export type LogEntry = {
  id: string // Cursor pointing at the first byte of this entry
  timestamp: string // ISO timestamp
  level: string // Lowercase level name, e.g. "info" or "warn"
  message: string
}

// A page of log entries, oldest first
export type LogPage = {
  entries: LogEntry[]
  before: string | null // Cursor to request older entries, or null when nothing older exists
  after: string // Cursor directly after the newest entry in this page
}

// A daily combined log file on disk
export type LogFile = {
  date: string // DD-MM-YYYY as it appears in the file name
  path: string
  key: number // YYYYMMDD so files sort chronologically
}

// A single line of a log file and the byte offset where it starts
type LogLine = {
  offset: number
  text: string
}

// A cursor decoded into the file date and byte offset it points at
type Cursor = {
  date: string
  offset: number
}

// Bytes read from disk at a time
const chunkSize = 64 * 1024

// Newline byte. Safe to search for in UTF-8 because it never appears inside multi-byte characters.
const newline = 0x0a

// Matches the combined log file names written by the logger
const logFileRegex = /^combined-(\d{2})-(\d{2})-(\d{4})\.log$/

// Matches the start of a new log entry: [DD-MM-YYYY HH:mm:ss] [<emoji> <LEVEL>] message
const entryStartRegex = /^\[(\d{2}-\d{2}-\d{4} \d{2}:\d{2}:\d{2})\] \[([^\]]*)\] ?(.*)$/

// Matches terminal colour codes so they can be removed from messages
const ansiRegex = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*[A-Za-z]`, "g")

// Convert a DD-MM-YYYY date into a sortable YYYYMMDD number
const dateKey = (date: string): number => {
  const [day, month, year] = date.split("-")
  return Number(`${year}${month}${day}`)
}

// Build a cursor string from a file date and byte offset
export const makeCursor = (date: string, offset: number): string => `${date}:${offset}`

// Decode a cursor string, or return null if it is malformed
export const parseCursor = (cursor: unknown): Cursor | null => {
  if (typeof cursor !== "string") return null
  const match = /^(\d{2}-\d{2}-\d{4}):(\d+)$/.exec(cursor)
  return match ? { date: match[1], offset: Number(match[2]) } : null
}

// Today's date in the format the logger uses for file names
export const todayLogDate = (): string => moment().format("DD-MM-YYYY")

// List every combined log file in a directory, oldest first
export const listLogFiles = async (dir: string): Promise<LogFile[]> => {
  let names: string[] = []

  try {
    names = await fs.promises.readdir(dir)
  } catch {
    return []
  }

  return names
    .map((name) => {
      const match = logFileRegex.exec(name)
      if (!match) return null
      const date = `${match[1]}-${match[2]}-${match[3]}`
      return { date, path: path.join(dir, name), key: dateKey(date) }
    })
    .filter((file): file is LogFile => file !== null)
    .sort((a, b) => a.key - b.key)
}

// Read a range of bytes from an open file
const readRange = async (
  handle: fs.promises.FileHandle,
  start: number,
  length: number,
): Promise<Buffer> => {
  const buffer = Buffer.alloc(length)
  const { bytesRead } = await handle.read(buffer, 0, length, start)
  return buffer.subarray(0, bytesRead)
}

// The byte offset just after the last complete line of a file, ignoring a line still being written
export const alignedEnd = async (filePath: string): Promise<number> => {
  const handle = await fs.promises.open(filePath, "r")

  try {
    const { size } = await handle.stat()
    let end = size

    // Walk back through chunks until the last newline is found
    while (end > 0) {
      const start = Math.max(0, end - chunkSize)
      const chunk = await readRange(handle, start, end - start)
      const index = chunk.lastIndexOf(newline)
      if (index !== -1) return start + index + 1
      end = start
    }

    return 0
  } finally {
    await handle.close()
  }
}

// Call onLine for each complete line from a byte offset onwards until it returns false or the file ends.
// Returns the offset after the last line consumed.
export const forEachLineForward = async (
  filePath: string,
  start: number,
  onLine: (line: LogLine) => boolean,
): Promise<number> => {
  const handle = await fs.promises.open(filePath, "r")

  try {
    let buffer: Buffer = Buffer.alloc(0)
    let bufferStart = start

    for (;;) {
      const index = buffer.indexOf(newline)

      // Read more when the buffer holds no complete line
      if (index === -1) {
        const chunk = await readRange(handle, bufferStart + buffer.length, chunkSize)
        if (chunk.length === 0) return bufferStart
        buffer = Buffer.concat([buffer, chunk])
        continue
      }

      const line = { offset: bufferStart, text: buffer.subarray(0, index).toString("utf8") }
      if (!onLine(line)) return bufferStart

      buffer = buffer.subarray(index + 1)
      bufferStart += index + 1
    }
  } finally {
    await handle.close()
  }
}

// Call onLine for each complete line before a byte offset, newest first, until it returns false or the file starts.
// The offset must sit directly after a newline (or be 0).
const forEachLineBackward = async (
  filePath: string,
  end: number,
  onLine: (line: LogLine) => boolean,
): Promise<void> => {
  const handle = await fs.promises.open(filePath, "r")

  try {
    let lineEnd = end // Exclusive end of the next line to emit, including its newline
    let buffer: Buffer = Buffer.alloc(0) // Holds bytes [bufferStart, lineEnd)
    let bufferStart = end

    while (lineEnd > 0) {
      const searchFrom = lineEnd - 2 - bufferStart
      const index = searchFrom >= 0 ? buffer.lastIndexOf(newline, searchFrom) : -1

      // Read an earlier chunk when this line's start isn't in the buffer yet
      if (index === -1 && bufferStart > 0) {
        const start = Math.max(0, bufferStart - chunkSize)
        buffer = Buffer.concat([await readRange(handle, start, bufferStart - start), buffer])
        bufferStart = start
        continue
      }

      const lineStart = index === -1 ? 0 : bufferStart + index + 1
      const text = buffer.subarray(lineStart - bufferStart, lineEnd - 1 - bufferStart).toString("utf8")

      if (!onLine({ offset: lineStart, text })) return

      lineEnd = lineStart
      buffer = buffer.subarray(0, lineStart - bufferStart)
    }
  } finally {
    await handle.close()
  }
}

// Remove colour codes and trailing whitespace from a line of message text
const cleanText = (text: string): string => text.replace(ansiRegex, "").trimEnd()

// Whether a line begins a new log entry
const isEntryStart = (text: string): boolean => entryStartRegex.test(text)

// Build an entry from its first line and any continuation lines (in file order)
const buildEntry = (date: string, first: LogLine, rest: LogLine[]): LogEntry => {
  const match = entryStartRegex.exec(first.text)
  const extra = rest.map((l) => cleanText(l.text)).filter((t) => t !== "")

  // Lines that don't start an entry (e.g. at the top of a file) become an entry of their own
  if (!match) {
    return {
      id: makeCursor(date, first.offset),
      timestamp: moment(date, "DD-MM-YYYY").toISOString(),
      level: "info",
      message: [cleanText(first.text), ...extra].join("\n"),
    }
  }

  const [, timestamp, levelLabel, message] = match

  return {
    id: makeCursor(date, first.offset),
    timestamp: moment(timestamp, "DD-MM-YYYY HH:mm:ss").toISOString(),
    level: (levelLabel.trim().split(/\s+/).pop() ?? "info").toLowerCase(),
    message: [cleanText(message), ...extra].join("\n"),
  }
}

// Append a continuation line to an entry being built
const appendLine = (entry: LogEntry, line: LogLine): void => {
  const text = cleanText(line.text)
  if (text !== "") entry.message += `\n${text}`
}

// Whether anything older than a cursor exists
const hasOlder = (files: LogFile[], cursor: Cursor): boolean =>
  cursor.offset > 0 || files.some((f) => f.key < dateKey(cursor.date))

// Read up to `limit` entries starting at a cursor, continuing into newer files
export const readForward = async (
  files: LogFile[],
  cursor: Cursor,
  limit: number,
): Promise<LogPage> => {
  const entries: LogEntry[] = []
  let after = makeCursor(cursor.date, cursor.offset)

  // Start in the cursor's file, or the next newer file if that one no longer exists
  let index = files.findIndex((f) => f.key >= dateKey(cursor.date))
  if (index === -1) return { entries, before: hasOlder(files, cursor) ? after : null, after }
  let offset = files[index].date === cursor.date ? cursor.offset : 0

  for (; index < files.length; index++, offset = 0) {
    const file = files[index]
    let pending: LogEntry | null = null
    let stoppedAt: number | null = null

    const end = await forEachLineForward(file.path, offset, (line) => {
      if (isEntryStart(line.text)) {
        if (pending) entries.push(pending)
        pending = null

        // Stop on the start of the entry that would go over the limit
        if (entries.length >= limit) {
          stoppedAt = line.offset
          return false
        }

        pending = buildEntry(file.date, line, [])
      } else if (pending) {
        appendLine(pending, line)
      } else if (line.text.trim() !== "") {
        pending = buildEntry(file.date, line, [])
      }

      return true
    })

    if (stoppedAt !== null) {
      after = makeCursor(file.date, stoppedAt)
      break
    }

    // Entries never span files, so whatever is pending at the end of a file is complete
    if (pending) entries.push(pending)
    after = makeCursor(file.date, end)

    if (entries.length >= limit) break
  }

  const first = entries[0] ? parseCursor(entries[0].id) : cursor
  return {
    entries,
    before: first && hasOlder(files, first) ? makeCursor(first.date, first.offset) : null,
    after,
  }
}

// Read up to `limit` entries directly before a cursor, continuing into older files
export const readBackward = async (
  files: LogFile[],
  cursor: Cursor,
  limit: number,
): Promise<LogPage> => {
  const newestFirst: LogEntry[] = []
  let after: string | null = null

  // Start in the cursor's file, or the next older file if that one no longer exists
  let index = -1
  for (let i = files.length - 1; i >= 0; i--) {
    if (files[i].key <= dateKey(cursor.date)) {
      index = i
      break
    }
  }

  for (; index >= 0 && newestFirst.length < limit; index--) {
    const file = files[index]
    const fileEnd = await alignedEnd(file.path)
    const end = file.date === cursor.date ? Math.min(cursor.offset, fileEnd) : fileEnd
    let continuation: LogLine[] = [] // Continuation lines seen so far, newest first

    await forEachLineBackward(file.path, end, (line) => {
      if (!isEntryStart(line.text)) {
        continuation.push(line)
        return true
      }

      newestFirst.push(buildEntry(file.date, line, continuation.reverse()))
      continuation = []
      after = after ?? makeCursor(file.date, end)
      return newestFirst.length < limit
    })

    // Continuation lines at the very top of a file have no first line, so they form their own entry
    const orphans = continuation.reverse().filter((l) => l.text.trim() !== "")
    if (orphans.length > 0 && newestFirst.length < limit) {
      newestFirst.push(buildEntry(file.date, orphans[0], orphans.slice(1)))
      after = after ?? makeCursor(file.date, end)
    }
  }

  const entries = newestFirst.reverse()
  const first = entries[0] ? parseCursor(entries[0].id) : null

  return {
    entries,
    before: first && hasOlder(files, first) ? makeCursor(first.date, first.offset) : null,
    after: after ?? makeCursor(cursor.date, cursor.offset),
  }
}

// Read the newest `limit` entries across all log files
export const readNewest = async (files: LogFile[], limit: number): Promise<LogPage> => {
  const latest = files[files.length - 1]
  if (!latest) return { entries: [], before: null, after: makeCursor(todayLogDate(), 0) }

  const end = await alignedEnd(latest.path)
  const page = await readBackward(files, { date: latest.date, offset: end }, limit)

  return { ...page, after: makeCursor(latest.date, end) }
}

// Follows the log files from a cursor and calls onEntry for each new complete entry.
// Handles the switch to a new day's file. Call the returned function to stop following.
export const followLogs = (
  dir: string,
  from: Cursor,
  onEntry: (entry: LogEntry) => void,
  skipId?: string,
): (() => void) => {
  const settleMs = 1000 // How long an entry must stop growing before it's sent, so continuation lines stay attached
  const pollMs = 1000

  let date = from.date
  let offset = from.offset
  let pending: LogEntry | null = null
  let lastGrowth = Date.now()
  let busy = false
  let stopped = false
  let watcher: fs.FSWatcher | null = null

  // Send an entry unless it's the one the client already has
  const emit = (entry: LogEntry): void => {
    if (entry.id !== skipId) onEntry(entry)
  }

  // Send the entry being built, if any
  const flush = (): void => {
    if (pending) emit(pending)
    pending = null
  }

  // Read anything new from the current file, then move on to a newer file once this one is finished
  const poll = async (): Promise<void> => {
    if (busy || stopped) return
    busy = true

    try {
      const files = await listLogFiles(dir)
      const current = files.find((f) => f.date === date)
      let grew = false

      if (current) {
        const { size } = await fs.promises.stat(current.path)
        if (size < offset) offset = 0 // The file was replaced, start from the top

        offset = await forEachLineForward(current.path, offset, (line) => {
          grew = true

          if (isEntryStart(line.text)) {
            flush()
            pending = buildEntry(date, line, [])
          } else if (pending) {
            appendLine(pending, line)
          } else if (line.text.trim() !== "") {
            pending = buildEntry(date, line, [])
          }

          return true
        })
      }

      if (grew) lastGrowth = Date.now()
      if (pending && Date.now() - lastGrowth >= settleMs) flush()

      // Switch to the next day's file once the current one has stopped growing
      const newer = files.find((f) => f.key > dateKey(date))
      if (newer && !grew) {
        flush()
        date = newer.date
        offset = 0
        lastGrowth = Date.now()
      }
    } catch {
      // A file can disappear between listing and reading. The next poll starts fresh.
    } finally {
      busy = false
    }
  }

  const timer = setInterval(() => void poll(), pollMs)

  // Poll straight away when the directory changes, where the platform supports watching
  try {
    watcher = fs.watch(dir, () => void poll())
    watcher.on("error", () => watcher?.close())
  } catch {
    watcher = null
  }

  void poll()

  return () => {
    stopped = true
    clearInterval(timer)
    watcher?.close()
  }
}
