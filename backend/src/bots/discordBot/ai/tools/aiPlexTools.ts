import { Message } from "discord.js"
import { BotUserType } from "../../../../models/settings"
import { PlexAccount, getCachedPlexAccounts } from "../../../../shared/plexRequests"
import { matchedDiscordUser, matchedUser } from "../../discordBotUtility"
import {
  NamedBotUser,
  PlexLinkChange,
  clearProposal,
  describeGuess,
  findPlexAccountByName,
  getProposal,
  guessPlexLinks,
  plexAccountOwner,
  rankPlexAccounts,
  savePlexLinks,
  storeProposal,
} from "../aiPlexLinks"
import { ToolContext, ToolHandler, ToolInput, inputString } from "./aiToolTypes"

// Most Plex account names listed back to the model at once
const MAX_LISTED_ACCOUNTS = 15

// Every Discord name a bot user goes by in this server: display name, nickname and global name
const discordNamesFor = (message: Message, botUser: BotUserType): string[] => {
  const members = message.guild?.members.cache
  if (!members) return []

  return botUser.ids.flatMap((username) => {
    const member = members.find((m) => m.user.username === username)
    return member ? [member.displayName, member.nickname ?? "", member.user.globalName ?? ""] : []
  })
}

// Every bot user with all the names they go by
const namedUsers = (ctx: ToolContext): NamedBotUser[] =>
  ctx.settings.general_bot.users.map((botUser) => ({
    botUser,
    names: [botUser.name, ...botUser.ids, ...discordNamesFor(ctx.message, botUser)].filter(Boolean),
  }))

// List Plex account names in a short comma separated line
const listAccounts = (accounts: PlexAccount[]): string =>
  accounts.length
    ? accounts.slice(0, MAX_LISTED_ACCOUNTS).map((a) => `"${a.name}"`).join(", ")
    : "none"

// Find a bot user by their Automatarr name, Discord username, display name or mention
const findBotUser = async (ctx: ToolContext, identifier: string): Promise<BotUserType | undefined> => {
  const lowered = identifier.toLowerCase()
  const byName = ctx.settings.general_bot.users.find(
    (u) => u.name.toLowerCase() === lowered || u.ids.some((id) => id.toLowerCase() === lowered),
  )
  if (byName) return byName

  const member = ctx.message.guild ? await matchedDiscordUser(ctx.message, identifier) : undefined
  return member ? matchedUser(ctx.settings, member.user.username) : undefined
}

// Why Plex linking can't happen right now, or an empty string if it can
const plexUnavailable = (): string =>
  getCachedPlexAccounts().length ? "" : "Plex accounts haven't loaded yet. Try again in a few minutes."

// A hint for the model when the speaker has no Plex link, naming their likeliest unclaimed accounts
export const unlinkedPlexHint = (ctx: ToolContext): string => {
  const botUser = matchedUser(ctx.settings, ctx.identity.username)
  if (!botUser) return "The speaker isn't a registered Automatarr user, so they can't be linked to Plex yet."

  const names = [botUser.name, ...botUser.ids, ...discordNamesFor(ctx.message, botUser)]
  const guesses = rankPlexAccounts(names).filter((a) => !plexAccountOwner(ctx.settings, a.id))

  return guesses.length
    ? `The speaker isn't linked to a Plex account yet. Likely matches: ${listAccounts(guesses)}. Ask if one of those is them, then use link_my_plex.`
    : "The speaker isn't linked to a Plex account yet. Ask them their Plex username, then use link_my_plex."
}

// Admin only. Guess a Plex account for every user and hold the proposal for confirmation.
const proposePlexLinks: ToolHandler = async (ctx) => {
  if (!ctx.isAdmin) return "Refused. Only admins can pair everyone's Plex accounts."
  const unavailable = plexUnavailable()
  if (unavailable) return unavailable

  const guesses = guessPlexLinks(namedUsers(ctx))
  storeProposal(ctx.identity.id, guesses)

  const pairedIds = new Set(guesses.map((g) => g.account?.id))
  const unpairedAccounts = getCachedPlexAccounts().filter((a) => !pairedIds.has(a.id))

  return [
    "Proposed pairings. Show them to the admin and ask them to confirm or correct them, then use confirm_plex_links.",
    ...guesses.map(describeGuess),
    `Plex accounts nobody is paired with: ${listAccounts(unpairedAccounts)}`,
  ].join("\n")
}

// Turn the model's list of corrections into link changes. Returns the changes and any it couldn't resolve.
const parseChanges = async (
  ctx: ToolContext,
  raw: unknown,
): Promise<{ changes: PlexLinkChange[]; problems: string[] }> => {
  const changes: PlexLinkChange[] = []
  const problems: string[] = []
  const entries = Array.isArray(raw) ? raw.slice(0, 50) : []

  for (const entry of entries) {
    const input = (entry && typeof entry === "object" ? entry : {}) as ToolInput
    const userName = inputString(input, "user", 50)
    const accountName = inputString(input, "plex_account", 50)

    const botUser = userName ? await findBotUser(ctx, userName) : undefined
    if (!botUser) {
      problems.push(`No Automatarr user called "${userName}".`)
      continue
    }

    if (!accountName || accountName.toLowerCase() === "none") {
      changes.push({ userId: String(botUser._id), account: null })
      continue
    }

    const { account, options } = findPlexAccountByName(accountName)
    if (account) {
      changes.push({ userId: String(botUser._id), account })
    } else {
      problems.push(
        options.length
          ? `"${accountName}" could be ${listAccounts(options)}. Which one?`
          : `No Plex account called "${accountName}".`,
      )
    }
  }

  return { changes, problems }
}

// Admin only. Save the pending proposal plus any corrections.
const confirmPlexLinks: ToolHandler = async (ctx, input) => {
  if (!ctx.isAdmin) return "Refused. Only admins can pair everyone's Plex accounts."
  const unavailable = plexUnavailable()
  if (unavailable) return unavailable

  const proposal = getProposal(ctx.identity.id) ?? []
  const { changes, problems } = await parseChanges(ctx, input.changes)

  // Corrections override the proposal for the same user
  const corrected = new Set(changes.map((c) => c.userId))
  const fromProposal: PlexLinkChange[] = proposal
    .filter((g) => g.account && g.confidence !== "linked" && !corrected.has(g.userId))
    .map((g) => ({ userId: g.userId, account: g.account }))

  const all = [...fromProposal, ...changes]
  if (!all.length) {
    return problems.length ? problems.join("\n") : "Nothing to save. Use propose_plex_links first."
  }

  const saved = await savePlexLinks(all)
  if (!saved) return "Couldn't save the Plex links."

  ctx.settings = saved
  clearProposal(ctx.identity.id)

  const summary = all.map((c) => {
    const name = saved.general_bot.users.find((u) => String(u._id) === c.userId)?.name ?? "Unknown"
    return `${name} ↔ ${c.account ? `Plex "${c.account.name}"` : "unlinked"}`
  })

  return [`Saved ${all.length} link${all.length === 1 ? "" : "s"}:`, ...summary, ...problems].join("\n")
}

// Link the speaker to their own Plex account
const linkMyPlex: ToolHandler = async (ctx, input) => {
  const unavailable = plexUnavailable()
  if (unavailable) return unavailable

  const botUser = matchedUser(ctx.settings, ctx.identity.username)
  if (!botUser) return "The speaker isn't a registered Automatarr user, so there's nothing to link yet. An admin can !init them."

  const accountName = inputString(input, "plex_account", 50)
  if (!accountName) return "A Plex account name is required."

  const { account, options } = findPlexAccountByName(accountName)
  if (!account) {
    return options.length
      ? `"${accountName}" could be ${listAccounts(options)}. Ask which one.`
      : `No Plex account called "${accountName}". Accounts on the server: ${listAccounts(getCachedPlexAccounts())}.`
  }

  const owner = plexAccountOwner(ctx.settings, account.id)
  if (owner && String(owner._id) !== String(botUser._id)) {
    return `Plex "${account.name}" is already linked to ${owner.name}. Only an admin can move it.`
  }

  const saved = await savePlexLinks([{ userId: String(botUser._id), account }])
  if (!saved) return "Couldn't save the Plex link."

  ctx.settings = saved
  return `Linked the speaker to Plex "${account.name}". Their watch history is available now.`
}

// Handlers for every Plex linking tool, keyed by tool name
export const PLEX_LINK_HANDLERS: Record<string, ToolHandler> = {
  propose_plex_links: proposePlexLinks,
  confirm_plex_links: confirmPlexLinks,
  link_my_plex: linkMyPlex,
}
