import logger from "../logger"

// Work that must run before Automatarr exits, such as leaving download clients with safe speed limits.
// Hooks run in parallel and are cut off after a time limit so a stuck request can't stop the exit.

type ShutdownHook = { name: string; run: () => Promise<void> }

const hooks: ShutdownHook[] = []
let running: Promise<void> | null = null

// Register work to run before Automatarr exits. Registering the same name again replaces it
export const registerShutdownHook = (name: string, run: () => Promise<void>): void => {
  const existing = hooks.findIndex((h) => h.name === name)
  if (existing >= 0) hooks.splice(existing, 1)
  hooks.push({ name, run })
}

// Run every hook once, giving up after totalMs. A second call waits for the first rather than running again
export const runShutdownHooks = (totalMs: number): Promise<void> => {
  if (running) return running

  const all = Promise.all(
    hooks.map((hook) =>
      hook.run().catch((err) => logger.error(`Shutdown | ${hook.name} failed: ${err}`)),
    ),
  ).then(() => undefined)

  const timeout = new Promise<void>((resolve) =>
    setTimeout(() => {
      logger.warn(`Shutdown | Gave up waiting after ${totalMs / 1000}s.`)
      resolve()
    }, totalMs).unref(),
  )

  running = Promise.race([all, timeout])
  return running
}
