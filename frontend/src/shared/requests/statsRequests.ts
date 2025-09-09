import axios from "axios"
import { Dispatch, SetStateAction } from "react"
import { StatsType } from "../../types/statsType"
import { populateStats } from "./requestPopulation"
import { authCheck, getAxiosErrorMessage, handleResponseTokens, headers } from "./requestUtility"
import { UserType } from "../../types/userType"
import { NavigateFunction } from "react-router-dom"

export const getStats = async (
  setStats: Dispatch<SetStateAction<StatsType | null>>,
  user: UserType,
  setUser: Dispatch<SetStateAction<UserType>>,
  setLoading: Dispatch<SetStateAction<boolean>>,
  navigate: NavigateFunction,
): Promise<void> => {
  setLoading(true)

  try {
    const res = await axios.post(
      "",
      {
        query: `
          query {
            getStats {
              ${populateStats}
            }
          }
        `,
      },
      {
        headers: headers(user.token),
      },
    )

    // Check if the user is authorised
    authCheck(res.data.errors, setUser, navigate)

    if (res.data.errors) {
      console.error("getStats GraphQL errors:", res.data.errors)
      throw new Error(res.data.errors[0]?.message || "Failed to fetch stats")
    }

    if (res.data.data?.getStats) {
      setStats(res.data.data.getStats)
      handleResponseTokens(res.data, setUser)
    } else {
      console.warn("No stats data received")
      setStats(null)
    }
  } catch (err) {
    console.error("Error fetching stats:", err)
    const errorMessage = getAxiosErrorMessage(err)
    throw new Error(errorMessage)
  } finally {
    setLoading(false)
  }
}