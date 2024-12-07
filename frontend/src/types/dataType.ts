export interface baseData {
  name: string
  created_at: string
  updated_at: string
}

// The data a Nivo Line chart expects
export type nivoData = {
  id: string
  data: {
    x: string
    y: number
  }[]
}

// Data prepared for Nivo frontend charts
export interface nivoCharts extends baseData {
  wanted_mising: nivoData[]
  import_blocked: nivoData[]
  remove_failed: nivoData[]
  remove_missing: nivoData[]
  permissions_change: nivoData[]
  [key: string]: nivoData[] | string
}

// Main dataType
export interface dataType {
  _id: string
  nivoCharts: nivoCharts
  created_at: string
  updated_at: string
}
