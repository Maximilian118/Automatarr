# Changelog

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
