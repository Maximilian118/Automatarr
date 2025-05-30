export type QualityProfile = {
  name: "Radarr" | "Sonarr" | "Lidarr"
  data: QualityProfileData[]
}

export type QualityProfileData = {
  id: number
  name: string
  upgradeAllowed: boolean
  cutoff: number
  items: QualityProfileItem[]
  minFormatScore: number
  cutoffFormatScore: number
  minUpgradeFormatScore: number
  formatItems: FormatItem[]
  language: Language
}

export type QualityProfileItem = {
  id: number
  name: string
  quality: Quality
  items: string[]
  allowed: boolean
}

export type Quality = {
  id: number
  name: string
  source: "unknown" | "web" | "bluray" | "dvd" | "television" | "vhs" | string
  resolution: number
  modifier: "none" | string
}

export type FormatItem = {
  id: number
  format: number
  name: string
  score: number
}

export type Language = {
  id: number
  name: string
}
