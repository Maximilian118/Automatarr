import mongoose, { FilterQuery } from "mongoose"
import { AuthRequest, requireAuth } from "../../middleware/auth"
import Activity, { ActivityType } from "../../models/activity"

// Page size bounds for the activity feed
const defaultActivityLimit = 50
const maxActivityLimit = 200

type ActivityItem = Omit<ActivityType, "_id" | "at"> & { _id: string; at: string }

type ActivityPage = {
  items: ActivityItem[]
  next: string | null
  sources: { source: string; count: number }[]
  tokens: string[]
}

const activityResolvers = {
  // A newest-first page of recorded removals, optionally filtered by source, plus every source with its count
  getActivity: async (
    args: { before?: string; limit?: number; source?: string },
    req: AuthRequest,
  ): Promise<ActivityPage> => {
    requireAuth(req)

    const limit = Math.min(Math.max(args.limit ?? defaultActivityLimit, 1), maxActivityLimit)
    const filter: FilterQuery<ActivityType> = {}

    if (args.source) filter.source = args.source
    if (args.before && mongoose.isValidObjectId(args.before)) {
      filter._id = { $lt: new mongoose.Types.ObjectId(args.before) }
    }

    // Fetch one extra record to know whether another page exists
    const [records, sources] = await Promise.all([
      Activity.find(filter).sort({ _id: -1 }).limit(limit + 1).lean(),
      Activity.aggregate<{ _id: string; count: number }>([
        { $group: { _id: "$source", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
    ])

    const items = records.slice(0, limit).map((r) => ({
      ...r,
      _id: r._id.toString(),
      at: new Date(r.at).toISOString(),
    }))

    return {
      items,
      next: records.length > limit ? items[items.length - 1]._id : null,
      sources: sources.map((s) => ({ source: s._id, count: s.count })),
      tokens: req.tokens,
    }
  },
}

export default activityResolvers
