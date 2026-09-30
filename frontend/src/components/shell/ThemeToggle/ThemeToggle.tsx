import React from "react"
import { LucideIcon, Monitor, Moon, Sun } from "lucide-react"
import { ThemePreference } from "../../../shared/theme/themeMode"
import { useThemeMode } from "../../../shared/theme/useThemeMode"
import "./_themeToggle.scss"

interface ThemeOption {
  value: ThemePreference
  label: string
  icon: LucideIcon
}

const options: ThemeOption[] = [
  { value: "system", label: "System", icon: Monitor },
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
]

interface ThemeToggleProps {
  // "segmented" shows all three choices; "cycle" is a single button for narrow spaces
  variant?: "segmented" | "cycle"
}

// Lets the viewer follow the system theme or force light or dark
const ThemeToggle: React.FC<ThemeToggleProps> = ({ variant = "segmented" }) => {
  const { preference, setPreference } = useThemeMode()

  if (variant === "cycle") {
    const index = options.findIndex((o) => o.value === preference)
    const current = options[index]
    const next = options[(index + 1) % options.length]
    const Icon = current.icon

    return (
      <button
        type="button"
        className="theme-cycle"
        onClick={() => setPreference(next.value)}
        aria-label={`Theme: ${current.label}. Switch to ${next.label}`}
      >
        <Icon aria-hidden="true" />
        <span className="theme-cycle-label">{current.label}</span>
      </button>
    )
  }

  return (
    <fieldset className="theme-toggle">
      <legend>Theme</legend>
      <div className="theme-toggle-options">
        {options.map(({ value, label, icon: Icon }) => (
          <label key={value} className={`theme-toggle-option${preference === value ? " is-selected" : ""}`}>
            <input
              type="radio"
              name="theme-preference"
              value={value}
              checked={preference === value}
              onChange={() => setPreference(value)}
            />
            <Icon aria-hidden="true" />
            <span>{label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  )
}

export default ThemeToggle
