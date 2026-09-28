import moment from "moment"
import logger from "../../../logger"
import AIState, { PendingArrival } from "../../../models/aiState"
import Data, { dataDocType, library } from "../../../models/data"
import Settings, { settingsDocType } from "../../../models/settings"
import { Movie } from "../../../types/movieTypes"
import { Series } from "../../../types/seriesTypes"
import { matchedUser } from "../discordBotUtility"
import { aiConfigured } from "./aiClient"
import { getLibraries } from "./aiMediaFormat"
import { DiscordIdentity, findMemory } from "./aiMemory"
import {
  buildProfile,
  canRecommend,
  Candidate,
  ContentType,
  eligibleMemories,
  genreOverlap,
  hasSeen,
  isDownloaded,
  passesRatingFloor,
  personEligible,
  recommend,
  RecipientProfile,
  scoreFor,
} from "./aiRecommendations"

// New arrivals older than this are no longer "new"
const ARRIVAL_EXPIRY_DAYS = 3

// Maximum arrivals waiting to be considered
const MAX_PENDING_ARRIVALS = 20

// A new arrival must match at least this many of someone's favourite genres
const MIN_GENRE_OVERLAP = 2

// Someone counts as returning after being away this long
const RETURNING_AFTER_DAYS = 14

// Wait this long after a returning user speaks so the recommendation follows their command or chat
const RETURNING_DELAY_MS = 30 * 1000

// How many arrivals-while-away the model chooses between
const RETURNING_SHORTLIST_SIZE = 3

// Map library items by ID for one Starr app
const itemsById = <T extends Movie | Series>(libraries: library[], name: "Radarr" | "Sonarr"): Map<number, T> =>
  new Map(((libraries.find((l) => l.name === name)?.data ?? []) as T[]).map((item) => [item.id, item]))

// Compare library snapshots and return anything that has just become watchable.
// Returns nothing when there's no previous snapshot, so a first load isn't treated as all new.
export const findNewArrivals = (previous: library[], next: library[]): PendingArrival[] => {
  const arrivals: PendingArrival[] = []
  const arrived_at = moment().format()

  const pairs: { name: "Radarr" | "Sonarr"; contentType: ContentType }[] = [
    { name: "Radarr", contentType: "movie" },
    { name: "Sonarr", contentType: "series" },
  ]

  pairs.forEach(({ name, contentType }) => {
    const before = itemsById<Movie | Series>(previous, name)
    if (before.size === 0) return

    itemsById<Movie | Series>(next, name).forEach((item, id) => {
      const old = before.get(id)
      if (isDownloaded(contentType, item) && !(old && isDownloaded(contentType, old))) {
        arrivals.push({ content_type: contentType, library_id: id, arrived_at })
      }
    })
  })

  return arrivals
}

// Drop arrivals that are too old and keep the newest within the cap
const prunePending = (pending: PendingArrival[]): PendingArrival[] =>
  pending
    .filter((a) => moment().diff(moment(a.arrived_at), "days") < ARRIVAL_EXPIRY_DAYS)
    .slice(-MAX_PENDING_ARRIVALS)

// Queue new arrivals to be considered for a recommendation
export const queueArrivals = async (settings: settingsDocType, arrivals: PendingArrival[]): Promise<void> => {
  if (!aiConfigured(settings.ai_bot) || !settings.ai_bot.recommendations || arrivals.length === 0) return

  const state = await AIState.findOneAndUpdate({}, { $setOnInsert: { pending_arrivals: [] } }, { upsert: true, new: true })
  const known = new Set(state.pending_arrivals.map((a) => `${a.content_type}:${a.library_id}`))
  const fresh = arrivals.filter((a) => !known.has(`${a.content_type}:${a.library_id}`))

  state.pending_arrivals = prunePending([...state.pending_arrivals, ...fresh])
  state.updated_at = moment().format()
  await state.save()

  logger.info(`AI Bot | Queued ${fresh.length} new arrivals for possible recommendations.`)
}

// Find the person a new arrival suits best, if anyone suits it strongly enough
const bestRecipientFor = async (
  settings: settingsDocType,
  contentType: ContentType,
  item: Movie | Series,
): Promise<RecipientProfile | null> => {
  let best: { profile: RecipientProfile; overlap: number } | null = null

  for (const { memory, botUser } of await eligibleMemories(settings)) {
    const profile = await buildProfile(memory, botUser)
    if (hasSeen(profile, contentType, item)) continue

    const overlap = genreOverlap(profile, item)
    if (overlap >= MIN_GENRE_OVERLAP && (!best || overlap > best.overlap)) best = { profile, overlap }
  }

  return best?.profile ?? null
}

// Try to recommend one queued arrival to the person it suits best. Called hourly.
// Arrivals nobody suits yet stay queued until they expire.
export const processPendingArrivals = async (settings: settingsDocType): Promise<void> => {
  if (!(await canRecommend(settings))) return

  const state = await AIState.findOne()
  const pending = prunePending(state?.pending_arrivals ?? [])
  if (!state || pending.length === 0) return

  const { movies, series } = getLibraries((await Data.findOne()) as dataDocType | null)

  // Newest arrivals first
  for (const arrival of [...pending].reverse()) {
    const item =
      arrival.content_type === "movie"
        ? movies.find((m) => m.id === arrival.library_id)
        : series.find((s) => s.id === arrival.library_id)

    if (!item || !passesRatingFloor(arrival.content_type, item)) continue

    const profile = await bestRecipientFor(settings, arrival.content_type, item)
    if (!profile) continue

    const candidate: Candidate = { contentType: arrival.content_type, item, score: 0 }
    const sent = await recommend(settings, profile, [candidate], "It has just landed in the library.")

    if (sent) {
      state.pending_arrivals = pending.filter((a) => a !== arrival)
      await state.save()
    }

    // One recommendation at most. Pacing takes care of the rest.
    return
  }
}

// Find the best things that arrived while someone was away
const arrivalsSince = (
  data: dataDocType | null,
  profile: RecipientProfile,
  since: string,
): Candidate[] => {
  const { movies, series } = getLibraries(data)
  const newSince = (item: Movie | Series) => !!item.added && moment(item.added).isAfter(moment(since))

  const collect = (contentType: ContentType, items: (Movie | Series)[]): Candidate[] =>
    items
      .filter((item) => newSince(item) && isDownloaded(contentType, item))
      .filter((item) => passesRatingFloor(contentType, item) && !hasSeen(profile, contentType, item))
      .map((item) => ({ contentType, item, score: scoreFor(profile, contentType, item) }))

  return [...collect("movie", movies), ...collect("series", series)]
    .filter((c) => genreOverlap(profile, c.item) > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, RETURNING_SHORTLIST_SIZE)
}

// Recommend something that arrived while a returning user was away
const recommendToReturningUser = async (identity: DiscordIdentity, awaySince: string): Promise<void> => {
  const settings = (await Settings.findOne()) as settingsDocType | null
  if (!settings || !(await canRecommend(settings))) return

  const memory = await findMemory(identity.id)
  const botUser = matchedUser(settings, identity.username)
  if (!memory || !botUser) return

  // They've just become active again, so check everything except recency
  if (!personEligible({ ...memory, last_active_at: moment().format() })) return

  const profile = await buildProfile(memory, botUser)
  const candidates = arrivalsSince((await Data.findOne()) as dataDocType | null, profile, awaySince)
  if (candidates.length === 0) return

  const weeks = Math.max(2, Math.round(moment().diff(moment(awaySince), "weeks", true)))
  await recommend(settings, profile, candidates, `They've been away for about ${weeks} weeks and these arrived while they were gone.`)
}

// When someone comes back after a long break, follow up shortly with something they missed
export const checkReturningUser = (identity: DiscordIdentity, previousActiveAt: string | null): void => {
  if (!previousActiveAt) return
  if (moment().diff(moment(previousActiveAt), "days") < RETURNING_AFTER_DAYS) return

  setTimeout(() => {
    recommendToReturningUser(identity, previousActiveAt).catch((err) =>
      logger.error(`AI Bot | Returning user recommendation failed: ${err}`),
    )
  }, RETURNING_DELAY_MS)
}
