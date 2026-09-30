import { Bot, Cable, History, ListVideo, LucideIcon, RefreshCw, ScrollText, Settings, Users, Waves } from "lucide-react"

export interface NavItem {
  text: string
  url: string
  icon: LucideIcon
  // Shown in the phone bottom bar; everything else lives in the "More" sheet
  primary: boolean
}

export interface NavGroup {
  label: string
  items: NavItem[]
}

// Every destination in the app, grouped by what the admin is doing
export const navGroups: NavGroup[] = [
  {
    label: "Overview",
    items: [
      { text: "Dashboard", url: "/", icon: Waves, primary: true },
      { text: "Activity", url: "/activity", icon: History, primary: true },
      { text: "Logs", url: "/logs", icon: ScrollText, primary: false },
    ],
  },
  {
    label: "Library",
    items: [
      { text: "Users", url: "/users", icon: Users, primary: true },
      { text: "Lists", url: "/lists", icon: ListVideo, primary: true },
    ],
  },
  {
    label: "Automation",
    items: [
      { text: "Loops", url: "/loops", icon: RefreshCw, primary: false },
      { text: "Bots", url: "/bots", icon: Bot, primary: false },
      { text: "Connections", url: "/connections", icon: Cable, primary: false },
      { text: "Settings", url: "/settings", icon: Settings, primary: false },
    ],
  },
]

// Flat list of every destination
export const navItems: NavItem[] = navGroups.flatMap((group) => group.items)

// Destinations shown directly in the phone bottom bar
export const primaryNavItems: NavItem[] = navItems.filter((item) => item.primary)

// Destinations tucked into the phone "More" sheet
export const secondaryNavItems: NavItem[] = navItems.filter((item) => !item.primary)
