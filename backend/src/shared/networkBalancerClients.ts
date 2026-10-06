import { AxiosError } from "axios"
import { settingsType } from "../models/settings"
import { DownloaderAdapter, DownloaderLimits, DownloaderName, Pair } from "../types/networkBalancerTypes"
import { getPriorityqBitCookie } from "./downloadPriorityClients"
import { describeRate, floorToKiB, KIB } from "./networkBalancerMath"
import {
  disableqBittorrentAltMode,
  fetchqBittorrentPreferences,
  getqBittorrentAltMode,
  getqBittorrentDownloadingCount,
  getqBittorrentTransferInfo,
  setqBittorrentPreferences,
} from "./qBittorrentRequests"
import {
  getSABnzbdMiscConfig,
  getSABnzbdSpeedState,
  setSABnzbdMiscConfig,
  setSABnzbdSpeedLimit,
  toggleSABnzbdSchedule,
} from "./sabnzbdRequests"

// Download speed above which a client counts as downloading even when its queue says otherwise
const ACTIVE_SPEED = 128 * KIB

// A limit of 0 means "no limit" to both clients
const limitOf = (value: number): number => (value > 0 ? value : Infinity)

// SABnzbd. Its limit is set through "Maximum line speed" at 100%, which SABnzbd saves to sabnzbd.ini, so a
// SABnzbd restart keeps the limit. The speedlimit API alone isn't saved and would be lost on restart.
const sabnzbdAdapter = (settings: settingsType): DownloaderAdapter => {
  const readLimits = async (): Promise<DownloaderLimits> => ({
    down: limitOf((await getSABnzbdSpeedState(settings)).limit),
    up: null,
  })

  // Enabled speedlimit schedules, which would overwrite the balancer's limit when they fire
  const speedSchedules = (lines: string[]) =>
    lines.filter((line) => {
      const parts = line.trim().split(/\s+/)
      return parts[0] === "1" && parts[4] === "speedlimit"
    })

  return {
    name: "sabnzbd",
    label: "SABnzbd",
    supports_upload: false,
    ack_ratio: 0.03,
    url: settings.sabnzbd_URL,

    readState: async () => {
      const state = await getSABnzbdSpeedState(settings)
      return {
        speed: { down: state.speed, up: 0 },
        limits: { down: limitOf(state.limit), up: null },
        active: !state.paused && state.jobs > 0 && (state.status === "Downloading" || state.speed > ACTIVE_SPEED),
        paused: state.paused,
        alt_mode: false,
      }
    },

    readLimits,

    // Line speed is written before the percentage, so every step in between is at or below the new limit
    applyLimits: async ({ down }) => {
      if (down === undefined) return

      const target = floorToKiB(down)
      const misc = await getSABnzbdMiscConfig(settings)

      if (misc.bandwidth_max !== target) await setSABnzbdMiscConfig(settings, "bandwidth_max", target)
      if (misc.bandwidth_perc !== 100) await setSABnzbdMiscConfig(settings, "bandwidth_perc", 100)
      if ((await readLimits()).down !== target) await setSABnzbdSpeedLimit(settings, "100")
    },

    snapshot: async () => {
      const misc = await getSABnzbdMiscConfig(settings)
      return [
        `Maximum line speed: ${misc.bandwidth_max ? describeRate(misc.bandwidth_max) : "not set"}`,
        `Percentage of line speed: ${misc.bandwidth_perc}%`,
        ...speedSchedules(misc.schedlines).map((line) => `Speed schedule: ${line}`),
      ]
    },

    enforceOwnership: async () => {
      const misc = await getSABnzbdMiscConfig(settings)
      const changes: string[] = []

      for (const line of speedSchedules(misc.schedlines)) {
        await toggleSABnzbdSchedule(settings, line)
        changes.push(`SABnzbd: turned off the speed schedule "${line}".`)
      }

      return changes
    },
  }
}

// Run a qBittorrent request with a valid session cookie, renewing the cookie once if qBittorrent rejects it
const withqBitCookie = async <T>(settings: settingsType, request: (cookie: string) => Promise<T>): Promise<T> => {
  const cookie = await getPriorityqBitCookie(settings, false)

  try {
    return await request(cookie)
  } catch (err) {
    const status = (err as AxiosError).response?.status
    if (status !== 401 && status !== 403) throw err

    const renewed = await getPriorityqBitCookie(settings, true)
    if (!renewed) throw err
    return request(renewed)
  }
}

// qBittorrent. Its normal global limits are set through preferences, which always target the normal limits
// whatever mode is on, and are saved, so a qBittorrent restart keeps them.
const qBittorrentAdapter = (settings: settingsType): DownloaderAdapter => {
  const readLimits = (): Promise<DownloaderLimits> =>
    withqBitCookie(settings, async (cookie) => {
      const info = await getqBittorrentTransferInfo(settings, cookie)
      return { down: limitOf(info.dl_rate_limit), up: limitOf(info.up_rate_limit) }
    })

  return {
    name: "qbittorrent",
    label: "qBittorrent",
    supports_upload: true,
    ack_ratio: 0.02,
    url: settings.qBittorrent_URL,

    readState: () =>
      withqBitCookie(settings, async (cookie) => {
        const [info, altMode, downloading] = await Promise.all([
          getqBittorrentTransferInfo(settings, cookie),
          getqBittorrentAltMode(settings, cookie),
          getqBittorrentDownloadingCount(settings, cookie),
        ])

        return {
          speed: { down: info.dl_info_speed, up: info.up_info_speed },
          limits: { down: limitOf(info.dl_rate_limit), up: limitOf(info.up_rate_limit) },
          active: downloading > 0 || info.dl_info_speed > ACTIVE_SPEED,
          paused: false,
          alt_mode: altMode,
        }
      }),

    readLimits,

    applyLimits: ({ down, up }) =>
      withqBitCookie(settings, (cookie) =>
        setqBittorrentPreferences(settings, cookie, {
          ...(down !== undefined && { dl_limit: floorToKiB(down) }),
          ...(up !== undefined && { up_limit: floorToKiB(up) }),
        }),
      ),

    snapshot: () =>
      withqBitCookie(settings, async (cookie) => {
        const prefs = await fetchqBittorrentPreferences(settings, cookie)
        const altMode = await getqBittorrentAltMode(settings, cookie)
        const time = (h: number, m: number) => `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`

        return [
          `Download limit: ${describeRate(prefs.dl_limit)}`,
          `Upload limit: ${describeRate(prefs.up_limit)}`,
          `Alternative download limit: ${describeRate(prefs.alt_dl_limit)}`,
          `Alternative upload limit: ${describeRate(prefs.alt_up_limit)}`,
          `Alternative limits in use: ${altMode ? "yes" : "no"}`,
          `Scheduler: ${
            prefs.scheduler_enabled
              ? `on, ${time(prefs.schedule_from_hour, prefs.schedule_from_min)} to ${time(prefs.schedule_to_hour, prefs.schedule_to_min)}`
              : "off"
          }`,
          `Apply limits to µTP: ${prefs.limit_utp_rate ? "yes" : "no"}`,
        ]
      }),

    // The scheduler is turned off first so it can't switch modes part way through. If the alternative limits are
    // in force, the normal limits are lowered to the floor before switching back, so switching never raises a limit.
    // The alternative limits are then lowered to the floor so a manual switch to them is always safe.
    enforceOwnership: (floor: Pair<number>) =>
      withqBitCookie(settings, async (cookie) => {
        const prefs = await fetchqBittorrentPreferences(settings, cookie)
        const changes: string[] = []
        const floorDown = floorToKiB(floor.down)
        const floorUp = floorToKiB(floor.up)

        if (prefs.scheduler_enabled) {
          await setqBittorrentPreferences(settings, cookie, { scheduler_enabled: false })
          changes.push("qBittorrent: turned off the speed limit scheduler.")
        }

        if (await getqBittorrentAltMode(settings, cookie)) {
          await setqBittorrentPreferences(settings, cookie, { dl_limit: floorDown, up_limit: floorUp })
          await disableqBittorrentAltMode(settings, cookie)
          changes.push("qBittorrent: switched off the alternative speed limits.")
        }

        if (!prefs.limit_utp_rate) {
          await setqBittorrentPreferences(settings, cookie, { limit_utp_rate: true })
          changes.push("qBittorrent: turned on \"Apply rate limit to µTP protocol\" so µTP can't bypass the limits.")
        }

        if (limitOf(prefs.alt_dl_limit) > floorDown || limitOf(prefs.alt_up_limit) > floorUp) {
          await setqBittorrentPreferences(settings, cookie, { alt_dl_limit: floorDown, alt_up_limit: floorUp })
          changes.push(
            `qBittorrent: set the alternative limits to ${describeRate(floorDown)} down and ${describeRate(floorUp)} up.`,
          )
        }

        return changes
      }),
  }
}

// Every download client the balancer can control, with how to tell whether it's connected
export const BALANCER_DOWNLOADERS: {
  name: DownloaderName
  label: string
  connected: (settings: settingsType) => boolean
  url: (settings: settingsType) => string
  create: (settings: settingsType) => DownloaderAdapter
}[] = [
  {
    name: "sabnzbd",
    label: "SABnzbd",
    connected: (s) => !!s.sabnzbd_active && !!s.sabnzbd_URL,
    url: (s) => s.sabnzbd_URL,
    create: sabnzbdAdapter,
  },
  {
    name: "qbittorrent",
    label: "qBittorrent",
    connected: (s) => !!s.qBittorrent_active && !!s.qBittorrent_URL,
    url: (s) => s.qBittorrent_URL,
    create: qBittorrentAdapter,
  },
]

// Adapters for every client that's connected on the Connections page
export const connectedAdapters = (settings: settingsType): DownloaderAdapter[] =>
  BALANCER_DOWNLOADERS.filter((d) => d.connected(settings)).map((d) => d.create(settings))

// Adapters for the clients the balancer took over, as long as they're still at the same URL
export const managedAdapters = (
  settings: settingsType,
  managed: { name: DownloaderName; url: string }[],
): DownloaderAdapter[] =>
  BALANCER_DOWNLOADERS.filter((d) => managed.some((m) => m.name === d.name && m.url && m.url === d.url(settings))).map(
    (d) => d.create(settings),
  )

// The display name of a client
export const downloaderLabel = (name: DownloaderName): string =>
  BALANCER_DOWNLOADERS.find((d) => d.name === name)?.label ?? name
