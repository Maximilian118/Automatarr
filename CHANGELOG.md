# Changelog

## v0.7.0

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
