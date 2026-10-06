import moment from "moment"
import BotMemory from "../../models/botMemory"
import { settingsDocType } from "../../models/settings"
import { plexAccountForUser, titleKey } from "../../shared/plexRequests"
import { viewersSince } from "../../shared/plexWatch"
import { matchedUser } from "./discordBotUtility"
import { describeBrief, ratingOutOf10 } from "./ai/aiMediaFormat"
import { TasteProfile, buildTaste, hasSeen, isDownloaded, scoreFor } from "./ai/aiRecommendations"
import {
  IndexContentType,
  IndexedTitle,
  MATCH_THRESHOLD,
  buildQuery,
  ensureTitleIndex,
  indexedTitles,
  scoreTitle,
} from "./ai/aiTitleIndex"

// Browsing what's downloaded on the server: by genre, franchise, recency, rating or popularity, ranked
// by someone's taste. Rule based, so the ! commands use it as well as the AI.

// Who is browsing, and whether their own history may be used to rank and filter
export type BrowseViewer = {
  settings: settingsDocType
  discordId: string
  username: string
  personalAllowed: boolean // False when they're private and the reply is public
}

// Filters for browsing what's downloaded on the server
export type BrowseFilters = {
  type?: IndexContentType
  genre: string // Lower case, matched against each genre, e.g. "science fiction"
  keyword: string // A franchise, collection or title word
  recentDays: number // Only titles downloaded in the last N days. 0 = any time
  minRating: number // Out of 10. 0 = any rating
  unseen: boolean // Leave out what the viewer has watched, requested or pooled
  popular: boolean // Only titles people watched this month, most watched first
}

// A title found by browsing, with how many people watched it this month when ranking by popularity
export type BrowseResult = { entry: IndexedTitle; viewers: number }

// What a browse found. popularUnavailable is true when popularity was asked for without Plex.
export type BrowseOutcome = {
  results: BrowseResult[]
  total: number
  seenChecked: boolean // False when unseen was asked for but the viewer's history can't be used
  popularUnavailable: boolean
  taste: TasteProfile | null // The viewer's taste, when it was used for ranking
}

// Most titles a browse returns
const MAX_BROWSE_RESULTS = 8

// How many days count as "this month" for popularity
const POPULAR_DAYS = 30

// Build the viewer's taste profile for ranking and seen checks. Null when they aren't registered or their
// history can't be used, in which case browsing ranks by rating instead.
const viewerTaste = async (viewer: BrowseViewer): Promise<TasteProfile | null> => {
  const botUser = matchedUser(viewer.settings, viewer.username)
  if (!botUser || !viewer.personalAllowed) return null

  return buildTaste(viewer.settings, viewer.discordId, viewer.username, botUser)
}

// Check a library title against the browse filters
const passesBrowseFilters = (entry: IndexedTitle, filters: BrowseFilters): boolean => {
  const { item } = entry
  if (filters.type && entry.type !== filters.type) return false
  if (!isDownloaded(entry.type, item)) return false
  if (filters.genre && !(item.genres ?? []).some((g) => g.toLowerCase().includes(filters.genre))) return false
  if (filters.recentDays && moment().diff(moment(entry.fileAddedAt), "days") > filters.recentDays) return false
  if (filters.minRating && ratingOutOf10(entry.type, item) < filters.minRating) return false

  if (filters.keyword) {
    const collection = "collection" in item ? (item.collection?.title ?? "") : ""
    const query = buildQuery(filters.keyword)
    const inCollection = !!collection && titleKey(collection).includes(query.key)
    if (!inCollection && scoreTitle({ ...entry, year: item.year }, query) < MATCH_THRESHOLD) return false
  }

  return true
}

// Plex accounts of members who keep their viewing private. They're left out of popularity counts.
export const privatePlexAccounts = async (settings: settingsDocType): Promise<Set<number>> => {
  const members = await BotMemory.find({ "preferences.private": true }, { username: 1 }).lean()
  const accounts = members.map((m) => plexAccountForUser(settings, matchedUser(settings, m.username), m.username))
  return new Set(accounts.filter((id): id is number => id !== null))
}

// Find downloaded titles matching the filters, best first: most watched when ranking by popularity,
// newest when browsing recent arrivals, otherwise best for the viewer's taste or highest rated
export const browseMatches = async (viewer: BrowseViewer, filters: BrowseFilters): Promise<BrowseOutcome> => {
  if (filters.popular && !viewer.settings.plex_active) {
    return { results: [], total: 0, seenChecked: true, popularUnavailable: true, taste: null }
  }

  await ensureTitleIndex()

  const taste = await viewerTaste(viewer)
  const excluded = filters.popular ? await privatePlexAccounts(viewer.settings) : new Set<number>()
  const tasteScore = (e: IndexedTitle): number => (taste ? scoreFor(taste, e.type, e.item) : ratingOutOf10(e.type, e.item))

  const matches = indexedTitles()
    .filter((e) => passesBrowseFilters(e, filters))
    .filter((e) => !filters.unseen || !taste || !hasSeen(taste, e.type, e.item))
    .map((entry) => ({ entry, viewers: filters.popular ? viewersSince(entry.type, entry.item, POPULAR_DAYS, excluded) : 0 }))
    .filter((r) => !filters.popular || r.viewers > 0)

  const ranked = matches.sort((a, b) =>
    filters.popular
      ? b.viewers - a.viewers || tasteScore(b.entry) - tasteScore(a.entry)
      : filters.recentDays
        ? b.entry.fileAddedAt - a.entry.fileAddedAt
        : tasteScore(b.entry) - tasteScore(a.entry),
  )

  return {
    results: ranked.slice(0, MAX_BROWSE_RESULTS),
    total: matches.length,
    seenChecked: !filters.unseen || !!taste,
    popularUnavailable: false,
    taste,
  }
}

// Describe a browse result in one line, with recent viewers or the download date when relevant
export const describeBrowseResult = (result: BrowseResult, filters: BrowseFilters): string =>
  [
    describeBrief(result.entry.type, result.entry.item),
    result.viewers ? `watched by ${result.viewers} ${result.viewers === 1 ? "person" : "people"} this month` : "",
    filters.recentDays && result.entry.fileAddedAt ? `downloaded ${moment(result.entry.fileAddedAt).format("D MMM")}` : "",
  ]
    .filter(Boolean)
    .join(" | ")

// Filters with nothing set, to build on
export const emptyBrowseFilters = (): BrowseFilters => ({
  genre: "",
  keyword: "",
  recentDays: 0,
  minRating: 0,
  unseen: false,
  popular: false,
})
