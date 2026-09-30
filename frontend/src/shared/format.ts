import moment from "moment"

const BINARY_UNITS = ["B", "KiB", "MiB", "GiB", "TiB", "PiB"]

// Human-readable size using binary units, labelled honestly (1 TiB = 1024⁴ bytes)
export const formatSize = (bytes: number | null | undefined, decimals = 1): string => {
  if (bytes === null || bytes === undefined || !isFinite(bytes)) return "Unknown size"
  if (bytes <= 0) return "0 B"

  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), BINARY_UNITS.length - 1)
  const value = bytes / Math.pow(1024, index)
  return `${value.toFixed(index === 0 ? 0 : decimals)} ${BINARY_UNITS[index]}`
}

// Bytes expressed in TiB, for storage figures that should share one unit
export const toTiB = (bytes: number): number => bytes / Math.pow(1024, 4)

// Whole numbers with thousands separators
export const formatCount = (value: number | null | undefined): string =>
  value === null || value === undefined ? "–" : Math.round(value).toLocaleString()

// "12 minutes ago" / "in 3 hours"
export const formatRelative = (iso: string | Date | null | undefined): string =>
  iso ? moment(iso).fromNow() : "Never"

// "14:05" for today, otherwise "3 Sep, 14:05"
export const formatWhen = (iso: string | Date | null | undefined): string => {
  if (!iso) return "Never"
  const m = moment(iso)
  return m.isSame(moment(), "day") ? m.format("HH:mm") : m.format("D MMM, HH:mm")
}

// Full date and time for machine-readable <time> titles
export const formatFull = (iso: string | Date): string => moment(iso).format("dddd D MMMM YYYY, HH:mm:ss")

// Minutes expressed in the largest whole unit: "every 10 minutes", "every 4 hours", "every day"
export const formatInterval = (mins: number | null | undefined): string => {
  if (!mins || mins <= 0) return "Not scheduled"
  const units: [number, string][] = [
    [10080, "week"],
    [1440, "day"],
    [60, "hour"],
    [1, "minute"],
  ]
  const [factor, unit] = units.find(([f]) => mins % f === 0 && mins >= f) ?? [1, "minute"]
  const count = mins / factor
  return count === 1 ? `Every ${unit}` : `Every ${count} ${unit}s`
}

// A formatter that keeps one binary unit for every value on a chart axis, chosen from the largest value
export const fixedUnitFormatter = (maxBytes: number, decimals = 1): ((bytes: number) => string) => {
  const index = maxBytes > 0 ? Math.min(Math.floor(Math.log(maxBytes) / Math.log(1024)), BINARY_UNITS.length - 1) : 0
  const divisor = Math.pow(1024, index)
  return (bytes: number) => `${(bytes / divisor).toFixed(index === 0 ? 0 : decimals)} ${BINARY_UNITS[index]}`
}

// Round axis ticks for a storage chart: 4-6 evenly spaced values in one binary unit, ending at or above maxBytes
export const storageTicks = (maxBytes: number): { ticks: number[]; max: number } => {
  if (maxBytes <= 0) return { ticks: [0], max: 1 }
  const index = Math.min(Math.floor(Math.log(maxBytes) / Math.log(1024)), BINARY_UNITS.length - 1)
  const divisor = Math.pow(1024, index)
  const inUnit = maxBytes / divisor
  const rough = inUnit / 5
  const magnitude = Math.pow(10, Math.floor(Math.log10(rough)))
  const step = [1, 2, 2.5, 5, 10].map((m) => m * magnitude).find((m) => m >= rough) ?? 10 * magnitude
  const count = Math.ceil(inUnit / step)
  const ticks = Array.from({ length: count + 1 }, (_, i) => i * step * divisor)
  return { ticks, max: ticks[ticks.length - 1] }
}
