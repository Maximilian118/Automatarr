# Changelog

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
