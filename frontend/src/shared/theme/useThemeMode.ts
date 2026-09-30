import { useContext } from "react"
import { ThemeModeContext, ThemeModeContextType } from "./themeMode"

// Access the current theme preference, the resolved theme and its colour tokens
export const useThemeMode = (): ThemeModeContextType => {
  const context = useContext(ThemeModeContext)
  if (!context) throw new Error("useThemeMode must be used inside ThemeModeProvider")
  return context
}
