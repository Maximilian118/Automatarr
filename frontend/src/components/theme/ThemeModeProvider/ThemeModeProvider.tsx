import React, { ReactNode, useCallback, useEffect, useMemo, useState } from "react"
import { ThemeProvider } from "@mui/material/styles"
import {
  applyTheme,
  onSystemThemeChange,
  readStoredPreference,
  readTokens,
  resolveTheme,
  storePreference,
  systemPrefersDark,
  ThemeModeContext,
  ThemePreference,
} from "../../../shared/theme/themeMode"
import { createAppTheme } from "../../../shared/theme/muiTheme"

interface ThemeModeProviderProps {
  children: ReactNode
}

// Owns the light/dark theme: follows the OS by default, lets the viewer override it,
// and keeps the MUI theme and chart tokens in step with the CSS custom properties
const ThemeModeProvider: React.FC<ThemeModeProviderProps> = ({ children }) => {
  const [preference, setPreferenceState] = useState<ThemePreference>(readStoredPreference)
  const [prefersDark, setPrefersDark] = useState<boolean>(systemPrefersDark)

  // Track the operating system theme so "system" follows it live
  useEffect(() => onSystemThemeChange(setPrefersDark), [])

  const resolved = resolveTheme(preference, prefersDark)

  // Stamp the theme on <html> before reading tokens so the computed values belong to the new theme
  const { tokens, muiTheme } = useMemo(() => {
    applyTheme(resolved)
    const currentTokens = readTokens()
    return { tokens: currentTokens, muiTheme: createAppTheme(currentTokens, resolved) }
  }, [resolved])

  // Save and apply a new preference
  const setPreference = useCallback((next: ThemePreference) => {
    storePreference(next)
    setPreferenceState(next)
  }, [])

  const value = useMemo(
    () => ({ preference, resolved, tokens, setPreference }),
    [preference, resolved, tokens, setPreference],
  )

  return (
    <ThemeModeContext.Provider value={value}>
      <ThemeProvider theme={muiTheme}>{children}</ThemeProvider>
    </ThemeModeContext.Provider>
  )
}

export default ThemeModeProvider
