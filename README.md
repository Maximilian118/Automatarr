<div align="center">

<img alt="Automatarr" src="https://automatarr.s3.eu-west-2.amazonaws.com/automatarr_logo.webp" width=300/>

_Like this app? Thanks for giving it a_ ⭐️

<a href="https://coff.ee/maximilian118" target="_blank"><img src="https://cdn.buymeacoffee.com/buttons/default-orange.png" alt="Buy Me A Coffee" height="41" width="174"></a>

[![Build](https://img.shields.io/github/actions/workflow/status/Maximilian118/Automatarr/docker-publish.yml?branch=main&label=build)](https://github.com/Maximilian118/Automatarr/actions)
[![License](https://img.shields.io/github/license/Maximilian118/Automatarr)](https://github.com/Maximilian118/Automatarr/blob/main/LICENSE)
[![Version](https://img.shields.io/github/package-json/v/Maximilian118/Automatarr?filename=backend%2Fpackage.json&label=version)](https://github.com/Maximilian118/Automatarr/releases)

</div>

## Overview

Automatarr keeps your media library fresh on limited storage by automatically cycling content based on your Radarr/Sonarr import lists.

When content drops off your import lists and isn't in anyone's user pool, it's safely removed — always respecting torrent seeding requirements. Your library stays current without you touching anything.

Each user has a pool of protected content that is immune to automated cleanup. The Discord bot lets users manage their own pools — downloading and removing content without needing access to Radarr/Sonarr or contacting the server owner.

## Feature overview:

Loops:

- Library Cleanup - Remove all library content not in Starr App Import Lists while respecting download ratio/time requirements and protecting user pool content.
- Content Search - Search for all wanted missing items across all Starr Apps.
- Queue Cleaner - Monitor and remove all blocked or problematic downloads in the queue.
- Failed Cleanup - Remove all failed downloads from disk.
- Tidy Directories - Remove all unwanted files and directories in the provided paths.
- Permissions Change - Change ownership and permissions of completed downloads.

Bots:

- User Pools - Each user has a pool of content they've downloaded to the server. Users pools are immune to being removed by loops.
- User permission hierarchy - Can assign admins and super users.
- Custom pool size - Each user's limits can be overwritten higher or lower.
- Download - Each user can download x amount of movies with Radarr or series with Sonarr.
- Remove - Each user can remove from their own pool.
- Blocklist - Users can mark a download as unsatisfactory, blocklist it and start a new download.
- Live download status - `!list` and `!waittime` show what's really happening: downloading with progress and time left, queued with its place in line, paused, stalled, importing, searching or waiting for release.

Download clients:

- qBittorrent - Seeding-aware cleanup, so nothing is removed before it has met its seeding requirements.
- SABnzbd (optional) - Discord requests jump to the front of the queue, and real queue positions, progress and time left feed the bot.

Claude AI (optional, bring your own Anthropic API key):

- Chat - Automatarr chats in character when someone @mentions it, replies to it, calls it by name (or a nickname that person gave it), or carries on a conversation after it replies. Everything else is ignored for free.
- Plain-English requests - "Grab me Dune" works from any channel or DM. The download output always lands in the right movie or series channel, folded into one reply.
- Command help - Well-formed `!` commands never touch the AI. Malformed or unknown ones are passed to the AI, which runs the corrected command or explains how to type it.
- Knows the server - Finds any title in the library or on TMDB/TVDB with its download status, quality, release dates and who has it, knows your live downloads, and can explain what was removed and why.
- Memory and privacy - Remembers what people like. Users can say "keep my info private", "stop learning about me" or "forget me". Admins can view and delete memories on the Users page.
- Recommendations - From what's on the server that you haven't watched, what's popular this month, or anything else. Proactive ones are rare and event-based: when something new lands that matches someone's taste or when someone comes back after a while.
- Web lookups (optional) - Cast, news and box office the library can't answer, capped at 60 searches a month.
- Budget - A monthly spend cap (default $2.50). If the AI is off, out of credit or over budget, the bot falls back to classic `!` commands.

Plex (optional):

- Watch activity - Library Cleanup keeps anything someone is watching or watched in the last 14 days, and `!blocklist` won't delete a file mid-stream.
- Watched in `!list` - Shows when you last watched each film or series (hidden for private users).
- Better AI - Recommendations skip what you've seen, and the AI knows what you're part way through.

## Running Automatarr with Docker Compose:

To run Automatarr using Docker, follow these steps:

1. **Make sure you have Docker and Docker Compose installed on any Unix based system**

💡 Check with: `docker compose version`.
If your version is below v2.0.0, use `docker-compose` for commands (with a dash) instead of `docker compose`.

2. **Create a `docker-compose.yml` File**

Create a `docker-compose.yml` file in your desired directory and add the following content:

```yaml
services:
  automatarr:
    container_name: automatarr
    image: ghcr.io/maximilian118/automatarr:latest
    restart: unless-stopped
    ports:
      - "8090:8090" # Frontend
      - "8091:8091" # Backend
    volumes:
      - ./automatarr/database:/app/automatarr_database
      - ./automatarr/logs:/app/automatarr_logs
      - ./automatarr/backups:/app/automatarr_backups
      - /:/host_fs
```

3. `docker compose pull`
4. `docker compose up -d`
5. `docker compose logs -f automatarr` - All backend information is here
6. Open the web app and start on the **Connections** page: add Radarr and Sonarr first, then your download clients, then Plex if you use it.

If successful and the application is running, a directory named `automatarr` will be created alongside the `docker-compose.yml` file. The `automatarr` directory contains a `database` directory where `MongoDB` stores its local database, as well as a `logs` directory where all backend logs are stored.

`/:/host_fs` exposes your machine's entire filesystem to Automatarr. If you're not comfortable with this, that's absolutely fine — simply omit it. However, this means Automatarr will not have access to, and therefore cannot manipulate, content outside of what is achievable through API requests.

### Versions and updates

| Image tag | What it is |
| --- | --- |
| `:latest` | The newest release. Recommended for most people. |
| `:0.8.0` (any `X.Y.Z`) | One exact release, if you want to pin a version or roll back. |
| `:0.8` (any `X.Y`) | The newest patch of a minor version. |
| `:edge` | Unreleased work from the `main` branch. May be unstable. |

To update, run `docker compose pull` then `docker compose up -d`. What changed in each release is in [CHANGELOG.md](CHANGELOG.md) and on the [Releases](https://github.com/Maximilian118/Automatarr/releases) page.

Releasing (maintainers): bump the version in `backend/package.json` and `frontend/package.json`, add a section to `CHANGELOG.md`, commit, then push a matching tag, e.g. `git tag v0.8.0 && git push origin v0.8.0`. The workflow builds the versioned images, moves `:latest` and creates the GitHub Release from the changelog.

## Connect via Domain (NGINX + SSL)

To access Automatarr via a domain name (e.g. https://automatarr.yourdomain.com), use `NGINX` or `NGINX Proxy Manager` to forward traffic to the correct internal ports.

**Using NGINX manually:**

Replace 192.168.x.x with your server's internal IP, e.g. 192.168.1.100

```nginx
server {
  listen 443 ssl;
  server_name example.yourdomain.com;

  ssl_certificate     /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;

  location / {
    proxy_pass http://192.168.x.x:8090;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
  }

  location /graphql {
    proxy_pass http://192.168.x.x:8091/graphql;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
  }

  location /api {
    proxy_pass http://192.168.x.x:8091/api;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_buffering off;
    proxy_read_timeout 1h;
  }
}
```

**Using NGINX Proxy Manager GUI:**

Create a Proxy Host for example.yourdomain.com, forwarding to:

```nginx
Scheme: http
Forward Hostname/IP: 192.168.x.x
Forward Port: 8090
```

Under the Custom Locations tab, add:

```nginx
Location: /graphql
Scheme: http
Forward Hostname/IP: 192.168.x.x (Same IP)
Forward Port: 8091
```

Then click the cog symbol to open the textarea and paste the following:

```nginx
location /graphql {
  proxy_pass http://192.168.x.x:8091/graphql;
  proxy_set_header Host $host;
  proxy_set_header X-Real-IP $remote_addr;
}
```

Add a second custom location the same way for the logs page:

```nginx
Location: /api
Scheme: http
Forward Hostname/IP: 192.168.x.x (Same IP)
Forward Port: 8091
```

```nginx
location /api {
  proxy_pass http://192.168.x.x:8091/api;
  proxy_set_header Host $host;
  proxy_set_header X-Real-IP $remote_addr;
  proxy_buffering off;
  proxy_read_timeout 1h;
}
```

The /graphql and /api locations are required so the frontend can reach the backend through the same domain.

✅ That’s it! You can now access the app securely at https://example.yourdomain.com.

## To do:

- [x] Add Discord Bot
- [ ] Add Whatsapp Bot
- [x] Add stalled or slow download deletion
- [x] Add graphs for basic data visuals to stats page
- [ ] Add Lidarr support
- [ ] Add Readarr support
- [x] Add security
- [x] Add webhooks
- [x] Add periodic backups

## Legal Disclaimer

> **Automatarr is a content automation and management tool intended solely for use with legally acquired media.**  
> This software does **not host, index, or distribute** any content and does **not provide or promote access to pirated material**.
>
> Automatarr integrates with third-party applications (such as Radarr, Sonarr, and qBittorrent) to help users manage their **self-curated media libraries**. Any automation involving torrents or downloads is entirely under user control, and **it is the user's responsibility to comply with all applicable laws** in their country or region.
>
> The developer of Automatarr **does not condone or support piracy** and is **not liable for how others choose to use this software**.
