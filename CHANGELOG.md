# Changelog

## v0.8.0

### Live download status everywhere

Automatarr now reads the download clients themselves, not just Radarr and Sonarr's summary of the queue.

- **`!list`** shows what's happening to anything not downloaded yet, e.g. "Downloading 45%, 20m left", "Queued (#3 in line)", "Searching for a copy" or "Waiting for release (digital 14 Oct)". Partly downloaded series get a status line too.
- **`!waittime`** covers queued, paused, stalled, importing and delayed downloads, and explains why a title in the library isn't downloading instead of saying "not found".
- **`!download`** checks with Radarr that a file really exists before saying "already downloaded". Asking for something already downloading for someone else adds it to your pool and gets you your own "ready" ping. Incomplete series report their progress or start a search for the missing episodes.
- If Radarr or Sonarr can't be reached, the bot says the status is unavailable rather than "not downloading".

### SABnzbd

- New connection. Discord requests are moved to the front of the SABnzbd queue, ahead of everything else, in the order they were asked for.
- Real queue positions, progress and time left from SABnzbd (and qBittorrent) feed `!list`, `!waittime`, `!download` and the AI.

### Plex watch activity

Plex is now used for the one thing Radarr and Sonarr can't know: who watched what, and what's playing.

- **Protected from deletion**: Library Cleanup keeps anything being streamed, or watched by anyone in the last 14 days, and skips the run if Plex's watch data isn't available. `!blocklist` won't delete a film or episode someone is streaming.
- **Watched in `!list`**: "Watched: 12 Mar" for films and "Last watched: 3 days ago" for series. Hidden for people who keep their viewing private.
- Watch history is matched by TMDB/TVDB/IMDb ID through a small hourly map of the Plex library, so remakes (Dune 1984 vs 2021) and differently spelt titles are handled, and history reaches back much further.

### A smarter, cheaper Claude AI

- **Finds anything**: a new title index matches spacing, punctuation, accents, alternate titles and near years, and `find_title` searches the library and TMDB/TVDB in one go with download status, quality, release dates, who has it and whether you've watched it. It won't claim a film doesn't exist without checking.
- **Knows before it asks**: titles named in a message, your live downloads, and (for recommendation requests) the best unseen titles on the server are looked up for free before the AI is called, so most questions need no extra lookup.
- **Recommendations** from what's on the server and what you haven't seen, with "what's popular this month" (anonymous counts) and real "recently downloaded" dates.
- **Your Plex picture**: the AI knows what's unwatched in your pool and which shows you're part way through.
- **`server_info`**: answers "why did X disappear?" from the Activity log and "why is it slow?" with disk space and queue load.
- **Web lookups** (optional, capped at 60 a month) for cast, news and box office the library can't answer.
- **Personal nicknames**: names you give the bot get its attention, for you only, and it keeps its names for you and yours for it apart.
- **One reply per message**: a command's output is folded into the AI's answer instead of two messages.
- **Cost**: prompt caching on Haiku, a shorter persona and tool list, and a usage line in the logs for every request. A typical reply costs about the same as before while answering more.

### Fixes

- `!blocklist` and Queue Cleaner blocklist the exact bad release instead of whatever was grabbed most recently, and no longer crash when there's no grab in the history.
- `!remove` only cancels the remover's own notifications, so other people's "Remember X? It's here!" alerts survive.
- User Pool Content Checker no longer mistakes two titles for each other when both are missing an IMDb ID.
- Storage Cleaner skips folders changed in the last 6 hours, so a just-added title can't be deleted while the library catches up.
- Download embeds show a timestamp, real quality and size (no more placeholder "Bluray-1080p / 12.34 GiB") and mention you once.
- The stuck-notification cleanup pings the person who asked, never the bot itself, and won't mark a slow download "Not Found" while it's still in the queue.
- The no-webhook fallback waits for a file before saying "Ready".

### Web app

- The version is shown in the footer.
- Connections is first in the Automation menu, grouped into media managers, download clients and media server.

### Docker images

- `:latest` now means the latest release. Pushes to `main` publish `:edge`, and every release is also tagged `:X.Y.Z` and `:X.Y` so you can pin or roll back. See "Versions and updates" in the README.

## v0.7.0

### New: Claude AI for the Discord bot

Optional, bring your own Anthropic API key.

- **Chat**: talk to Automatarr in any channel or DM. It works out what you meant if you mistype a command.
- **Memory and privacy**: it remembers what you like and will occasionally recommend something. You choose what it remembers, can ask it to forget you, and can make your watch history private.
- **Plex**: connect Plex so the AI knows what people have been watching.
- **Shortcuts**: `!d` for `!download` and `!time` for `!wait`.
- **Change quality mid-download**: run `!download` again with a new quality and it switches over.
- **Suggestions with posters** when a title is asked for without a year.
- **Budget**: a monthly spend cap. Without the AI, every `!` command works exactly as before.

### Redesigned web app ("Reservoir")

The whole frontend has a new look built around what Automatarr does: keeping the drive from overflowing.

- **Dashboard** replaces Stats. The drive is drawn as a tank filled to its current level, with the line where bot requests pause. Beside it: used and free space, the library change and removals over 30 days, recent arrivals as a poster rail, and 30-day charts.
- **Light and dark themes**, following the device setting, with a System / Light / Dark switch in the navigation.
- **New navigation**: a side rail on desktop (compact on tablets) and a bottom bar with a "More" sheet on phones.
- **Save feedback everywhere**: every Save shows a toast and a persistent "Saved at" note, or explains why it failed.
- **Accessibility (WCAG AAA target)**: 7:1 text contrast in both themes, 44px touch targets, visible keyboard focus, reduced-motion support, confirmation before destructive actions (import list delete, AI "Forget", note delete), real labels on every switch, a table view for every chart, and a "Move to…" menu so pool items can move between users without dragging.
- Fonts (Bricolage Grotesque, Atkinson Hyperlegible Next) and the logo are bundled, so nothing is loaded from third-party CDNs.
- Pages load on demand, cutting the initial download from about 1 MB to about 420 KB.

### Charts fixed

- Charts used the day of the month as the x value, so Aug 27 and Sep 27 landed in the same slot and lines doubled back across the chart. They now use real dates on a time axis; missing days show as gaps.
- "Removed" now sums every hour of the day (it previously showed only the last hour, so it was almost always 0). Queues show the day's peak.
- Storage is labelled in binary units (TiB) with round ticks, a capacity line and a "Requests pause" line.
- The per-user storage chart is now a ranked bar list with every value written out, plus a whole-drive split of pool, other library content and free space.

### New: Activity

- A record of everything Automatarr removes (files, folders, library entries, torrents, queue items), with the loop or Discord command that removed it, size freed and reason. Kept for 90 days, filterable by source.
- Recording happens only after a removal has already succeeded and can never throw or delay the loop. No deletion logic was changed.
- The Loops page shows each loop's last run, next run and removals in the past 24 hours.

### New: Logs viewer

- Scroll up to load older lines, across previous days' log files; scroll down to load newer ones. At the bottom it follows new lines live; scrolled up, a "Jump to latest (n new)" button appears.
- Lines are coloured by level with a text label, grouped under date separators, and multi-line messages (stack traces) stay together.
- The stream reconnects on its own and follows the new day's file after midnight.
- Reverse proxies must now forward `/api` as well as `/graphql` (see the NGINX examples in the README).

### Security and fixes

- The logs API and the stats query now require login.
- GraphiQL is only enabled when `NODE_ENV=development`.
- The embedded database listens on 127.0.0.1 only. Set `DB_BIND_IP=0.0.0.0` to reach it from outside the container.
- The webhook on/off setting is now enforced, and changes to it apply without a restart.
- The Webhooks toggle in Settings now actually switches webhooks on and off.
- `!test` is admin-only, as the help text always said.
- `!stay` now counts towards a user's pool limit, like `!download`.
- `!superuser` names the right user when the user can't be found.
- The login page only offers "Create account" before the admin account exists.

## v0.6.0

### Lists Tab

A new **Lists** tab for managing Radarr/Sonarr import lists directly through the Automatarr UI. Changes are reflected instantly in Radarr/Sonarr and vice versa.

- Full CRUD — Add, edit, test, and delete import lists for both Radarr and Sonarr without leaving Automatarr.
- Per-list stats — Each list card shows a colour-coded progress bar (green = downloaded, orange = downloading, red = missing) with rich tooltip.
- Disk usage per list — Each card shows total storage used by downloaded content from that list.
- Disk usage colour spectrum — With 3+ lists, storage tags are colour-coded green to red relative to each other.
- Aggregate header stats — Each API section shows total downloaded, downloading, missing, and combined storage.
- Broken list detection — Invalid or deleted mdblist URLs show a red card background with error message tooltip.
- Test button — Validates import list configuration against Radarr/Sonarr with animated pass/fail feedback.

### Behaviour Change

- **Disabled lists now protect content** — Previously, disabling an import list caused its content to become eligible for deletion by Library Cleanup. Now disabled lists still protect their content. To remove content, delete the import list entirely. This aligns with Radarr/Sonarr behaviour.

### New Reusable Components

- **SegmentBar** — Configurable horizontal progress bar with segments, labels, thresholds, and tooltip.
- **ListCard** — Compact card with status indicator, title, children slot, tags (with optional colour), and error state.
- **Modal** — Base modal with title, optional icon, content slot, and configurable action buttons. Configs in `configs/` subdirectory.

## v0.5.0

- Fix (Critical): Torrents using global seeding settings (`ratio_limit=-1`) or unlimited seeding (`ratio_limit=-2`) were instantly passing seed checks and being deleted — causing hit-and-runs. Added `resolveEffectiveLimits()` to correctly resolve qBittorrent special values against global preferences.
- Fix: Library item deletion now checks both download completion AND seeding requirements. Previously only seeding was checked, allowing still-downloading torrents with residual ratio/time values to be deleted.
- Fix: Null/undefined torrent references now block deletion instead of silently allowing it.
- Fix: `deleteqBittorrent()` for superseded torrents is now awaited — deletion counter only increments on success.
- Fix: Unknown torrent items removed from Starr queue are now kept in qBittorrent for seed check safety, rather than being immediately removed from the client.
- Fix: Library-level cleanup now checks for active qBittorrent torrents before deleting directories from the filesystem.
- Fix: Stalled download tracking now uses `downloadId` instead of title, preventing counter carry-over when a torrent is blocklisted and re-grabbed with the same name.
- Added support for additional qBittorrent torrent states: `queuedUP`, `checkingUP`, `forcedUP`, `stoppedUP` (qBit 5.x compatibility).
- Added download protocol auto-detection via Starr app `/downloadclient` API. Automatarr now detects whether each Starr app is configured for torrent-only, usenet-only, or mixed downloads — preventing unsafe deletion of unmatched items in torrent-only setups.
- Protocol detection logged per API each cleanup cycle with client counts.

## v0.4.4

- Fix: Unknown queue items (no movieId/episodeId) stuck in infinite deletion loop — now removed from download client directly.
- Renamed all loop identifiers to match frontend display names (queue_cleaner, library_cleanup, content_search, failed_cleanup).

## v0.4.3 – v0.4.1

- D&D pool content moving in users tab & custom !download reply messages based on args.
- `!help Quality` command.
- Welcome message.
- `!download` with args more robust.
- Downloads now sorted in Radarr/Sonarr queues even if no media ID.

## v0.4.0

- Initial public release.
