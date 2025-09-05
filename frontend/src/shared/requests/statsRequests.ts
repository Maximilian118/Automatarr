import { Dispatch, SetStateAction } from "react"
import { UserType } from "../../types/userType"
import { NavigateFunction } from "react-router-dom"
import axios from "axios"
import { authCheck, getAxiosErrorMessage, handleResponseTokens, headers } from "./requestUtility"

export interface MediaCount {
  movies: number
  series: number
  episodes: number
}

export interface StatsSnapshot {
  timestamp: string
  downloaded: MediaCount
  deleted: MediaCount
  diskUsage: number
  activeDownloads: number
  queuedDownloads: number
  failedDownloads: number
  totalBandwidth: number
}

export interface HourlyStats {
  hour: string
  downloaded: MediaCount
  deleted: MediaCount
  averageDiskUsage: number
  averageBandwidth: number
  peakActiveDownloads: number
}

export interface StatsType {
  _id: string
  currentSnapshot: StatsSnapshot
  hourlyStats: HourlyStats[]
  dailyStats: HourlyStats[]
  created_at: string
  updated_at: string
}

export const getStats = async (
  user: UserType,
  setUser: Dispatch<SetStateAction<UserType>>,
  navigate: NavigateFunction,
  setLoading: Dispatch<SetStateAction<boolean>>,
): Promise<StatsType | undefined> => {
  setLoading(true)

  try {
    const res = await axios.post(
      "",
      {
        query: `
          query {
            getStats {
              data {
                _id
                currentSnapshot {
                  timestamp
                  downloaded {
                    movies
                    series
                    episodes
                  }
                  deleted {
                    movies
                    series
                    episodes
                  }
                  diskUsage
                  activeDownloads
                  queuedDownloads
                  failedDownloads
                  totalBandwidth
                }
                hourlyStats {
                  hour
                  downloaded {
                    movies
                    series
                    episodes
                  }
                  deleted {
                    movies
                    series
                    episodes
                  }
                  averageDiskUsage
                  averageBandwidth
                  peakActiveDownloads
                }
                dailyStats {
                  hour
                  downloaded {
                    movies
                    series
                    episodes
                  }
                  deleted {
                    movies
                    series
                    episodes
                  }
                  averageDiskUsage
                  averageBandwidth
                  peakActiveDownloads
                }
                created_at
                updated_at
              }
              tokens
            }
          }
        `,
      },
      { headers: headers(user.token) },
    )

    if (res.data.errors) {
      authCheck(res.data.errors, setUser, navigate)
      console.error(`getStats Error: ${res.data.errors[0].message}`)
    } else {
      const stats = handleResponseTokens(res.data.data.getStats, setUser) as { data: StatsType }
      console.log(`getStats: Stats retrieved successfully`)
      setLoading(false)
      return stats.data
    }
  } catch (err) {
    console.error(getAxiosErrorMessage(err))
  }

  setLoading(false)
  return undefined
}