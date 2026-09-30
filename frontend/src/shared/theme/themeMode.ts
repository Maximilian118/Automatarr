import { createContext } from "react"

export type ThemePreference = "system" | "light" | "dark"
export type ResolvedTheme = "light" | "dark"

// Colour tokens as resolved hex/rgba strings, read from the CSS custom properties in _tokens.scss
export interface ThemeTokens {
  abyss: string
  basin: string
  basinRaised: string
  basinSunken: string
  scrim: string
  ink: string
  inkMuted: string
  inkInverse: string
  line: string
  lineSoft: string
  inflow: string
  outflow: string
  threshold: string
  good: string
  waterTop: string
  waterDeep: string
  seriesDownloaded: string
  seriesQueued: string
  seriesDeleted: string
  accent: string
  accentInk: string
  accentHover: string
  focus: string
  hoverWash: string
  fontBody: string
  fontDisplay: string
}

export interface ThemeModeContextType {
  preference: ThemePreference
  resolved: ResolvedTheme
  tokens: ThemeTokens
  setPreference: (preference: ThemePreference) => void
}

const STORAGE_KEY = "theme_preference"
const DARK_QUERY = "(prefers-color-scheme: dark)"

// Read the saved preference. Storage can be unavailable (private mode, blocked site data), so fall back to the system setting
export const readStoredPreference = (): ThemePreference => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    return stored === "light" || stored === "dark" || stored === "system" ? stored : "system"
  } catch {
    return "system"
  }
}

// Persist the preference for this viewer only. Failure to store is harmless
export const storePreference = (preference: ThemePreference): void => {
  try {
    localStorage.setItem(STORAGE_KEY, preference)
  } catch {
    // Storage unavailable: the choice simply won't survive a reload
  }
}

// Whether the operating system currently prefers a dark interface
export const systemPrefersDark = (): boolean =>
  typeof window !== "undefined" && window.matchMedia(DARK_QUERY).matches

// Subscribe to operating system theme changes, returning an unsubscribe function
export const onSystemThemeChange = (callback: (prefersDark: boolean) => void): (() => void) => {
  const query = window.matchMedia(DARK_QUERY)
  const listener = (e: MediaQueryListEvent) => callback(e.matches)
  query.addEventListener("change", listener)
  return () => query.removeEventListener("change", listener)
}

// Turn a preference into the theme that should actually be shown
export const resolveTheme = (preference: ThemePreference, prefersDark: boolean): ResolvedTheme => {
  if (preference === "system") return prefersDark ? "dark" : "light"
  return preference
}

// Stamp the resolved theme on <html> so the CSS token blocks switch over
export const applyTheme = (resolved: ResolvedTheme): void => {
  document.documentElement.dataset.theme = resolved
}

// Maps each token to the CSS custom property that defines it
const tokenVariables: Record<keyof ThemeTokens, string> = {
  abyss: "--abyss",
  basin: "--basin",
  basinRaised: "--basin-raised",
  basinSunken: "--basin-sunken",
  scrim: "--scrim",
  ink: "--ink",
  inkMuted: "--ink-muted",
  inkInverse: "--ink-inverse",
  line: "--line",
  lineSoft: "--line-soft",
  inflow: "--inflow",
  outflow: "--outflow",
  threshold: "--threshold",
  good: "--good",
  waterTop: "--water-top",
  waterDeep: "--water-deep",
  seriesDownloaded: "--series-downloaded",
  seriesQueued: "--series-queued",
  seriesDeleted: "--series-deleted",
  accent: "--accent",
  accentInk: "--accent-ink",
  accentHover: "--accent-hover",
  focus: "--focus",
  hoverWash: "--hover-wash",
  fontBody: "--font-body",
  fontDisplay: "--font-display",
}

// Read the current values of every token from the document so JS libraries (MUI, Nivo) match the CSS
export const readTokens = (): ThemeTokens => {
  const styles = getComputedStyle(document.documentElement)

  return Object.fromEntries(
    Object.entries(tokenVariables).map(([key, variable]) => [key, styles.getPropertyValue(variable).trim()]),
  ) as unknown as ThemeTokens
}

export const ThemeModeContext = createContext<ThemeModeContextType | null>(null)
