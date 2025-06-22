import moment from "moment"
import { PoolType, BotUserType } from "../models/settings"

const initPool: PoolType = {
  movies: [],
  series: [],
  albums: [],
  books: [],
}

export const initUser = (
  name: string,
  username: string,
  super_user: boolean = false,
  admin: boolean = false,
): BotUserType => {
  return {
    name,
    ids: [username],
    admin,
    super_user,
    max_movies_overwrite: null,
    max_series_overwrite: null,
    pool: initPool,
    created_at: moment().format(),
    updated_at: moment().format(),
  }
}

// Input: ['TitleA 2000', 'TitleA 3000', 'TitleB 2000', 'TitleB 3000', 'TitleC 2000', 'TitleD 3000']
// Outpu: ['TitleA 3000', 'TitleA 2000', 'TitleB 3000', 'TitleB 2000', 'TitleC 2000', 'TitleD 3000']
export const sortTMDBSearchArray = <T extends { title: string; year: number }>(
  items: T[],
  searchYear: number | string,
): T[] => {
  const normalizedYear = typeof searchYear === "string" ? parseInt(searchYear, 10) : searchYear

  const parsed = items.map((item) => ({
    item,
    title: item.title.trim().toLowerCase(),
    year: item.year,
  }))

  const groupedMap = new Map<string, typeof parsed>()

  for (const entry of parsed) {
    if (!groupedMap.has(entry.title)) {
      groupedMap.set(
        entry.title,
        parsed.filter((p) => p.title === entry.title),
      )
    }
  }

  const groupOrder = [...new Set(parsed.map((p) => p.title))]

  const sorted = groupOrder.flatMap((title) => {
    const group = [...(groupedMap.get(title) ?? [])]

    // Prefer item with matching year if available
    const matchIndex = group.findIndex((entry) => entry.year === normalizedYear)

    if (matchIndex > 0) {
      const [match] = group.splice(matchIndex, 1)
      group.unshift(match)
    }

    return group.map((g) => g.item)
  })

  return sorted
}
