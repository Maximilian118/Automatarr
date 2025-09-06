import { NavigateFunction } from "react-router-dom"
import { baseURL, corsProxyStr, updateSession } from "../requests"
import logger from "../logger"
import { BotUserType } from "../../types/settingsType"

type UserContext = {
  name: string
  exp: number
  iat: number
} | null

export const getBotUsers = async (
  user: UserContext,
  setUser: (user: UserContext) => void,
  navigate: NavigateFunction,
  setLoading: (loading: boolean) => void
): Promise<BotUserType[] | undefined> => {
  setLoading(true)

  const query = `
    query {
      getBotUsers {
        _id
        name
        ids
        admin
        super_user
        max_movies_overwrite
        max_series_overwrite
        pool {
          movies {
            id
            title
            year
            tmdbId
          }
          series {
            id
            title
            year
            tvdbId
          }
        }
        created_at
        updated_at
      }
    }
  `

  try {
    const response = await fetch(baseURL + corsProxyStr, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + sessionStorage.getItem("token"),
      },
      body: JSON.stringify({
        query,
      }),
    })

    const result = await response.json()

    if (result.errors) {
      logger.error(result.errors[0].message)
      setLoading(false)
      return undefined
    }

    updateSession(result.data.getBotUsers.tokens, setUser, navigate, user)
    setLoading(false)
    return result.data.getBotUsers
  } catch (err: any) {
    logger.error("Request failed: " + err)
    setLoading(false)
    return undefined
  }
}

export const removeFromBotUserPool = async (
  user: UserContext,
  setUser: (user: UserContext) => void,
  navigate: NavigateFunction,
  setLoading: (loading: boolean) => void,
  userId: string,
  movieIds?: string[],
  seriesIds?: string[]
): Promise<BotUserType | undefined> => {
  setLoading(true)

  const mutation = `
    mutation RemoveFromBotUserPool($input: removeFromPoolInput!) {
      removeFromBotUserPool(input: $input) {
        _id
        name
        ids
        admin
        super_user
        max_movies_overwrite
        max_series_overwrite
        pool {
          movies {
            id
            title
            year
            tmdbId
          }
          series {
            id
            title
            year
            tvdbId
          }
        }
        created_at
        updated_at
      }
    }
  `

  try {
    const response = await fetch(baseURL + corsProxyStr, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + sessionStorage.getItem("token"),
      },
      body: JSON.stringify({
        query: mutation,
        variables: {
          input: {
            userId,
            movieIds: movieIds || [],
            seriesIds: seriesIds || [],
          },
        },
      }),
    })

    const result = await response.json()

    if (result.errors) {
      logger.error(result.errors[0].message)
      setLoading(false)
      return undefined
    }

    updateSession(result.data.removeFromBotUserPool.tokens, setUser, navigate, user)
    setLoading(false)
    return result.data.removeFromBotUserPool
  } catch (err: any) {
    logger.error("Request failed: " + err)
    setLoading(false)
    return undefined
  }
}