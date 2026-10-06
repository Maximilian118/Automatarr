import moment from "moment"
import logger from "../../../logger"
import Settings, { BotUserType, settingsDocType } from "../../../models/settings"
import { saveWithRetry } from "../../../shared/database"
import { PlexAccount, getCachedPlexAccounts } from "../../../shared/plexRequests"

// Links Discord bot users to Plex accounts. Links are stored by Plex account ID on the bot user
// and never change unless an admin or the user themselves changes them.

// How sure a guessed pairing is. linked = already saved, none = no plausible account.
export type PlexLinkConfidence = "linked" | "high" | "medium" | "low" | "none"

// One user's proposed Plex account
export type PlexLinkGuess = {
  userId: string
  userName: string
  account: PlexAccount | null
  confidence: PlexLinkConfidence
}

// A bot user and every name they go by, used for matching against Plex account names
export type NamedBotUser = {
  botUser: BotUserType
  names: string[]
}

// A link to save. A null account unlinks the user.
export type PlexLinkChange = {
  userId: string
  account: PlexAccount | null
}

// A proposal an admin has been shown and can confirm
type PendingProposal = {
  guesses: PlexLinkGuess[]
  expires: number // Epoch milliseconds
}

// How long an admin has to confirm a proposal
const PROPOSAL_TTL_MS = 30 * 60 * 1000

// Proposals waiting for confirmation, keyed by the admin's Discord ID
const pendingProposals = new Map<string, PendingProposal>()

// Scores for how closely two names resemble each other, mapped to a confidence
const SCORE_CONFIDENCE: Record<number, PlexLinkConfidence> = { 3: "high", 2: "medium", 1: "low" }

// Lowercase a name and strip everything but letters and digits
const normaliseName = (name: string): string => name.toLowerCase().replace(/[^a-z0-9]/g, "")

// Split a name into lowercase words of 3 or more characters
const nameWords = (name: string): string[] =>
  name.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length >= 3)

// Score how likely two names belong to the same person. 3 = identical, 0 = no resemblance.
const nameScore = (a: string, b: string): number => {
  const na = normaliseName(a)
  const nb = normaliseName(b)
  if (!na || !nb) return 0
  if (na === nb) return 3

  const contains = na.length >= 3 && nb.length >= 3 && (na.includes(nb) || nb.includes(na))
  if (contains || nameWords(a).some((w) => nameWords(b).includes(w))) return 2

  return na.length >= 4 && na.slice(0, 4) === nb.slice(0, 4) ? 1 : 0
}

// The best score between any of a user's names and a Plex account name
const userAccountScore = (names: string[], account: PlexAccount): number =>
  Math.max(0, ...names.map((n) => nameScore(n, account.name)))

// Find the Plex account a bot user is already linked to, if any
const linkedAccount = (botUser: BotUserType, accounts: PlexAccount[]): PlexAccount | null => {
  if (botUser.plex_account_id == null) return null

  return (
    accounts.find((a) => a.id === botUser.plex_account_id) ?? {
      id: botUser.plex_account_id,
      name: botUser.plex_username,
    }
  )
}

// Guess the best Plex account for every bot user. Linked users keep their link.
// The rest are paired greedily by name resemblance, using each Plex account at most once.
export const guessPlexLinks = (users: NamedBotUser[]): PlexLinkGuess[] => {
  const accounts = getCachedPlexAccounts()
  const guesses = new Map<string, PlexLinkGuess>()
  const taken = new Set<number>()

  users.forEach(({ botUser }) => {
    const account = linkedAccount(botUser, accounts)
    if (account) taken.add(account.id)
    guesses.set(String(botUser._id), {
      userId: String(botUser._id),
      userName: botUser.name,
      account,
      confidence: account ? "linked" : "none",
    })
  })

  const candidates = users
    .filter(({ botUser }) => botUser.plex_account_id == null)
    .flatMap(({ botUser, names }) =>
      accounts.map((account) => ({ userId: String(botUser._id), account, score: userAccountScore(names, account) })),
    )
    .filter((c) => c.score > 0)
    .sort((a, b) => b.score - a.score)

  candidates.forEach(({ userId, account, score }) => {
    const guess = guesses.get(userId)
    if (!guess || guess.account || taken.has(account.id)) return

    guess.account = account
    guess.confidence = SCORE_CONFIDENCE[score]
    taken.add(account.id)
  })

  return [...guesses.values()]
}

// Rank Plex accounts by how closely they match a set of names. Only accounts with some resemblance are returned.
export const rankPlexAccounts = (names: string[], limit: number = 3): PlexAccount[] =>
  getCachedPlexAccounts()
    .map((account) => ({ account, score: userAccountScore(names, account) }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((r) => r.account)

// Find a Plex account by name. Exact matches win, otherwise the single closest resemblance.
// Returns every close option when the name is ambiguous.
export const findPlexAccountByName = (name: string): { account: PlexAccount | null; options: PlexAccount[] } => {
  const accounts = getCachedPlexAccounts()
  const exact = accounts.find((a) => normaliseName(a.name) === normaliseName(name))
  if (exact) return { account: exact, options: [] }

  const scored = accounts
    .map((account) => ({ account, score: nameScore(name, account.name) }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)

  const best = scored.filter((r) => r.score === scored[0]?.score)
  return best.length === 1 ? { account: best[0].account, options: [] } : { account: null, options: best.map((r) => r.account) }
}

// Find which bot user, if any, a Plex account is linked to
export const plexAccountOwner = (settings: settingsDocType, accountId: number): BotUserType | undefined =>
  settings.general_bot.users.find((u) => u.plex_account_id === accountId)

// Save Plex links for several users at once. Each Plex account ends up linked to at most one user.
// Returns the saved settings, or null if they couldn't be saved.
export const savePlexLinks = async (changes: PlexLinkChange[]): Promise<settingsDocType | null> => {
  const settings = (await Settings.findOne()) as settingsDocType | null
  if (!settings) return null

  changes.forEach(({ userId, account }) => {
    const index = settings.general_bot.users.findIndex((u) => String(u._id) === userId)
    if (index === -1) return

    // Free the account from anyone else it was linked to
    if (account) {
      settings.general_bot.users.forEach((u, i) => {
        if (i !== index && u.plex_account_id === account.id) {
          u.plex_account_id = null
          u.plex_username = ""
          settings.markModified(`general_bot.users.${i}`)
        }
      })
    }

    const user = settings.general_bot.users[index]
    user.plex_account_id = account ? account.id : null
    user.plex_username = account ? account.name : ""
    user.updated_at = moment().format()
    settings.markModified(`general_bot.users.${index}`)
  })

  const saved = (await saveWithRetry(settings, "savePlexLinks")) as settingsDocType | undefined
  if (saved) logger.bot(`Plex | Saved ${changes.length} Plex link${changes.length === 1 ? "" : "s"}.`)

  return saved ?? null
}

// Describe one guessed pairing in a short line
export const describeGuess = (guess: PlexLinkGuess, index: number): string => {
  const account = guess.account ? `Plex "${guess.account.name}"` : "no Plex match"
  const confidence = guess.confidence === "none" ? "" : ` (${guess.confidence})`
  return `${index + 1}. ${guess.userName} ↔ ${account}${confidence}`
}

// Store a proposal for an admin to confirm later
export const storeProposal = (adminId: string, guesses: PlexLinkGuess[]): void => {
  pendingProposals.set(adminId, { guesses, expires: Date.now() + PROPOSAL_TTL_MS })
}

// Get an admin's pending proposal, if it hasn't expired
export const getProposal = (adminId: string): PlexLinkGuess[] | null => {
  const proposal = pendingProposals.get(adminId)
  if (!proposal) return null

  if (proposal.expires < Date.now()) {
    pendingProposals.delete(adminId)
    return null
  }

  return proposal.guesses
}

// Drop an admin's pending proposal once it's been confirmed
export const clearProposal = (adminId: string): void => {
  pendingProposals.delete(adminId)
}

// Describe an admin's pending proposal for their context, or an empty string if there isn't one
export const describePendingProposal = (adminId: string): string => {
  const guesses = getProposal(adminId)
  return guesses ? guesses.map(describeGuess).join("\n") : ""
}
