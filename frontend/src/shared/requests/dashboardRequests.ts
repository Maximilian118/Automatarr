import { LoopStatus, LoopStatusResult, Arrival, RecentArrivalsResult } from "../../types/dashboardType"
import { ActivityPage } from "../../types/activityType"
import { AuthHandlers, graphqlRequest } from "./graphqlRequest"

// Get the run state of every automation loop
export const getLoopStatus = async (auth: AuthHandlers): Promise<LoopStatus[]> => {
  const res = await graphqlRequest<LoopStatusResult>(
    "getLoopStatus",
    `query {
      getLoopStatus {
        loops { name active running interval_mins first_ran last_ran next_run deletions_24h }
        tokens
      }
    }`,
    undefined,
    auth,
  )
  return res.loops
}

// Get the titles that most recently became watchable
export const getRecentArrivals = async (limit: number, auth: AuthHandlers): Promise<Arrival[]> => {
  const res = await graphqlRequest<RecentArrivalsResult>(
    "getRecentArrivals",
    `query GetRecentArrivals($limit: Int) {
      getRecentArrivals(limit: $limit) {
        items { type title year poster added tmdbId }
        tokens
      }
    }`,
    { limit },
    auth,
  )
  return res.items
}

// Get one page of the removal history, newest first, optionally for a single source
export const getActivity = async (
  params: { before?: string | null; limit?: number; source?: string | null },
  auth: AuthHandlers,
): Promise<ActivityPage> =>
  graphqlRequest<ActivityPage>(
    "getActivity",
    `query GetActivity($before: String, $limit: Int, $source: String) {
      getActivity(before: $before, limit: $limit, source: $source) {
        items { _id at source action app title path bytes reason }
        next
        sources { source count }
        tokens
      }
    }`,
    { before: params.before ?? null, limit: params.limit ?? 50, source: params.source ?? null },
    auth,
  )
