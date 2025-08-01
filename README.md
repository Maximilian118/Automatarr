<img alt="Automatarr" src="https://automatarr.s3.eu-west-2.amazonaws.com/automatarr_logo.webp" width=300/>

_Like this app? Thanks for giving it a_ ⭐️

<a href="https://coff.ee/maximilian118" target="_blank"><img src="https://cdn.buymeacoffee.com/buttons/default-orange.png" alt="Buy Me A Coffee" height="41" width="174"></a>

## Overview

Automatarr reduces manual input tasks for Radarr & Sonarr and allows for the control of Starr apps through bots.
All bots abide by a unified pool system which regulates how much content users can download at once.

## Feature overview:

Loops:

- Remove Missing - Remove all library content not in Starr App Import Lists while respecting download ratio/time requirements.
- Wanted Missing - Search for all wanted missing items across all Starr Apps.
- Remove Blocked - Remove all blocked downloads in the queue.
- Remove Failed - Remove all failed downloads.
- Tidy Directories - Remove all unwanted files and directories in the provided paths.
- Permissions Change - Change ownership and permissions of completed downloads.

Bots:

- User Pools - Each user has a pool of content they've downloaded to the server. Users pools are immune to being removed by loops.
- User permission hierarchy - Can assign admins and super users.
- Custom pool size - Each user's limits can be overwritten higher or lower.
- Download - Each user can download x amount of movies with Radarr or series with Sonarr.
- Remove - Each user can remove from their own pool.
- Blocklist - Users can mark a download as unsatisfactory, blocklist it and start a new download.

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

If successful and the application is running, a directory named `automatarr` will be created alongside the `docker-compose.yml` file. The `automatarr` directory contains a `database` directory where `MongoDB` stores its local database, as well as a `logs` directory where all backend logs are stored.

`/:/host_fs` exposes your machine's entire filesystem to Automatarr. If you're not comfortable with this, that's absolutely fine — simply omit it. However, this means Automatarr will not have access to, and therefore cannot manipulate, content outside of what is achievable through API requests.

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

The /graphql location is required so the frontend can reach the backend through the same domain.

✅ That’s it! You can now access the app securely at https://example.yourdomain.com.

## To do:

- [x] Add Discord Bot
- [ ] Add Whatsapp Bot
- [x] Add stalled or slow download deletion
- [ ] Add graphs for basic data visuals to stats page
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
