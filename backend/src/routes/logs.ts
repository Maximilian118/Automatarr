import express, { NextFunction, Request, Response } from "express"
import { logDirectory } from "../logger"
import { AuthRequest } from "../middleware/auth"
import {
  followLogs,
  listLogFiles,
  makeCursor,
  parseCursor,
  readBackward,
  readForward,
  readNewest,
  todayLogDate,
} from "../shared/logReader"

const router = express.Router()

// Page size bounds for log requests
const defaultLimit = 200
const maxLimit = 1000

// How often to send a keep-alive comment on the live stream
const heartbeatMs = 30000

// Reject any request that isn't from a logged in web app user
router.use((req: Request, res: Response, next: NextFunction) => {
  if (!(req as AuthRequest).isAuth) {
    res.status(401).json({ message: "Unauthorised" })
    return
  }

  next()
})

// A page of log entries: the newest page, the page before a cursor, or the page after a cursor
router.get("/", async (req: Request, res: Response) => {
  const { tokens } = req as AuthRequest
  const requested = Number(req.query.limit)
  const limit = Number.isFinite(requested) && requested > 0 ? Math.min(requested, maxLimit) : defaultLimit
  const before = parseCursor(req.query.before)
  const after = parseCursor(req.query.after)

  try {
    const files = await listLogFiles(logDirectory)

    const page = before
      ? await readBackward(files, before, limit)
      : after
        ? await readForward(files, after, limit)
        : await readNewest(files, limit)

    res.json({ ...page, tokens: tokens ?? [] })
  } catch (err) {
    res.status(500).json({ message: `Failed to read logs: ${err}` })
  }
})

// A live stream of new log entries from a cursor onwards, as server-sent events
router.get("/stream", async (req: Request, res: Response) => {
  const { tokens } = req as AuthRequest
  const lastEventId = parseCursor(req.get("Last-Event-ID"))
  const from = lastEventId ?? parseCursor(req.query.from)

  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  })
  res.flushHeaders()

  // Hand refreshed login tokens to the client before any entries
  if (tokens && tokens.length > 0) {
    res.write(`event: tokens\ndata: ${JSON.stringify(tokens)}\n\n`)
  }

  // Without a cursor, start from the end of the newest file so only new entries are sent
  let start = from
  if (!start) {
    const newest = await readNewest(await listLogFiles(logDirectory), 1)
    start = parseCursor(newest.after) ?? { date: todayLogDate(), offset: 0 }
  }

  // On reconnect, resume from the last entry the client received but don't send it again
  const stop = followLogs(
    logDirectory,
    start,
    (entry) => res.write(`id: ${entry.id}\ndata: ${JSON.stringify(entry)}\n\n`),
    lastEventId ? makeCursor(lastEventId.date, lastEventId.offset) : undefined,
  )

  const heartbeat = setInterval(() => res.write(": heartbeat\n\n"), heartbeatMs)

  // Stop following and clear timers when the client goes away
  const cleanup = (): void => {
    stop()
    clearInterval(heartbeat)
  }

  req.on("close", cleanup)
  req.on("error", cleanup)
})

export default router
