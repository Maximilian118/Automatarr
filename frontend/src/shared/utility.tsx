import { Dispatch, SetStateAction } from "react"
import { settingsType } from "../types/settingsType"
import {
  checkLidarr,
  checkqBittorrent,
  checkRadarr,
  checkSonarr,
} from "./requests/checkAPIRequests"
import { UserType } from "../types/userType"
import { NavigateFunction } from "react-router-dom"

// Simple request response success indication
export const requestSuccess = (status: number): boolean => status >= 200 && status < 300

// Simple string mutations
export const capsFirstLetter = (str: string): string => str.charAt(0).toUpperCase() + str.slice(1)

// Check the status of each API by sending requests
export const checkAPIs = async (
  user: UserType,
  setUser: Dispatch<SetStateAction<UserType>>,
  navigate: NavigateFunction,
  settings: settingsType,
  newSettings?: true,
): Promise<settingsType> => {
  const newData = newSettings ? settings : undefined
  const [radarr_active, sonarr_active, lidarr_active, qBittorrent_active] = await Promise.all([
    checkRadarr(user, setUser, navigate, newData),
    checkSonarr(user, setUser, navigate, newData),
    checkLidarr(user, setUser, navigate, newData),
    checkqBittorrent(user, setUser, navigate, newData),
  ])

  return {
    ...settings,
    radarr_active,
    sonarr_active,
    lidarr_active,
    qBittorrent_active,
  }
}

// Check if any starr apps are connected
export const anyStarrActive = (settings: settingsType): boolean => {
  return Object.entries(settings)
    .filter(([key]) => key.includes('arr') && key.endsWith('_active'))
    .some(([, value]) => value === true)
}

// Pass a string literal and output respects new lines
export const multilineText = (string: string, className?: string) => {
  const lines = string.trim().split('\n')

  const paragraphs = lines.map((line, index) => {
    const trimmed = line.trim()

    if (!trimmed) {
      // Render vertical space between paragraphs
      return <div key={index} style={{ height: '1em' }} />
    }

    return (
      <p key={index}>
        {trimmed}
      </p>
    )
  })

  return <div className={className}>{paragraphs}</div>
}

// Check if a form error object has any populated strings. I.E if there are some errors return true.
export const formHasErr = <T extends Record<string, string | undefined>>(obj: T): boolean => 
  Object.values(obj).some((value) => (value ?? "").trim() !== "")

// Return chown string
export const createChownString = (
  user: string | null, 
  group: string | null, 
  settings: settingsType, 
  setSettings: Dispatch<SetStateAction<settingsType>>
) => {
  let chown = `${user ? user : ""}:${group ? group : ""}`

  if (!user || !group) {
    chown = ""
  }
  
  if (settings.permissions_change_chown !== chown) {
    setSettings(prevSettings => {
      return {
        ...prevSettings,
        permissions_change_chown: chown,
      }
    })
  }
}

// Output the last two dirs for the given path
export const shortPath = (path: string, depth: number = 2, ellipsis: boolean = true): string => {
  const parts = path.split('/').filter(Boolean) // Split and clean up the path
  
  // If the number of parts is less than or equal to depth, return the full path
  if (parts.length <= depth) {
    return `/${parts.join('/')}`
  }

  // If there are more parts than the depth, shorten the path
  const lastDirs = parts.slice(-depth).join('/') // Get the last `depth` directories
  return `${ellipsis ? ".../" : ""}${lastDirs}` // Show "..." for the parent directories, then the last `depth` directories
}

// Helper functions to use with Autocomplete when dealing with numbers
export const numberSelection = (endString?: string): string[] => {
  const base = [...Array(99)].map((_, i) => (i + 1).toString())
  return endString ? base.concat(endString) : base
}

export const stringSelectionToNumber = (value: string): number | null => value === "Infinite" ? null : parseInt(value, 10)
export const toStringWithCap = (num: number | null, max: number, maxString: string): string =>
  num === null ? maxString : num > max ? maxString : num.toString()

// A function to convert bytes into an readable string
export const formatBytes = (bytesInput: string | number, decimals = 2): string => {
  if (!bytesInput) {
    return ""
  }

  const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB']
  const k = 1024

  // Convert input to BigInt for safety
  const bytes = typeof bytesInput === 'string' ? BigInt(bytesInput) : BigInt(Math.floor(bytesInput))

  if (bytes === 0n) return '0B'

  // Find appropriate unit index using logarithmic approximation with BigInt
  let i = 0
  let temp = bytes
  while (temp >= BigInt(k) && i < sizes.length - 1) {
    temp /= BigInt(k)
    i++
  }

  // Convert the final value to a number for formatting
  const value = Number(bytes) / Math.pow(k, i)

  return `${parseFloat(value.toFixed(decimals))}${sizes[i]}`
}

// A function to convert an readable string into bytes
export const parseBytes = (input: string): string => {
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB']

  const match = input.trim().toLowerCase().match(/^([\d.]+)\s*(k|m|g|t|p|e|z|y)(b)?$/i)
  if (!match) return ""

  const numStr = match[1]
  const prefix = match[2].toUpperCase()
  const index = sizes.findIndex(size => size.startsWith(prefix))
  if (index === -1) return ""

  const num = parseFloat(numStr)
  if (isNaN(num)) return ""

  const bytes = BigInt(Math.floor(num * Math.pow(1024, index)))
  return bytes.toString()
}

export const webhookURL = (settings: settingsType): string => {
  const origin = window.location.origin
  const hostname = window.location.hostname

  const isLocal = /^(localhost|127\.|192\.168\.|10\.)/.test(hostname)

  const URL = `${origin}/graphql/webhooks?token=${settings.webhooks_token}`

  return isLocal ? "Invalid URL" : URL
}
