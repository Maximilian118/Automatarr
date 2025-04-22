<img alt="Automatarr" src="https://automatarr.s3.eu-west-2.amazonaws.com/automatarr_logo.webp" width=300/>

_Like this app? Thanks for giving it a_ ⭐️

## Overview

Automatarr reduces manual input tasks for Radarr & Sonarr and Lidarr.

Feature overview:

- Automatically handle items with an importBlocked status in the activity queue
- Automatically search for wanted missing items

## Running Automatarr with Docker

To run Automatarr using Docker, follow these steps:

1. **Create a `docker-compose.yml` File**

Create a file named `docker-compose.yml` in your desired directory and add the following content:

```yaml
version: "3.3"
services:
  automatarr:
    image: ghcr.io/maximilian118/automatarr:latest
    container_name: automatarr
    restart: always
    ports:
      - "8090:8090" # Frontend (served at localhost:8090)
      - "8091:8091" # Backend (served at localhost:8091)
    volumes:
      - ./automatarr/database:/app/automatarr_database
      - ./automatarr/logs:/app/automatarr_logs
      - /:/host_fs # Mount the host filesystem
    environment:
      # - VITE_BACKEND_IP=192.168.1.2 # Optional - Recommended
      # - VITE_BACKEND_PORT=8091 # Optional
      # - VITE_DATABASE_IP=172.0.0.2 # Optional
      # - VITE_DATABASE_PORT=27020 # Optional
```

2. `docker-compose pull`
3. `docker-compose up -d`

If you're accessing the frontend from a remote machine, I.E not localhost, you will need to tell the frontend where to find the backend server with the `VITE_BACKEND_IP` environment variable. This will be the IP of the machine docker-compose is running on.

If successful and the application is running, a directory named `automatarr` will be created alongside the `docker-compose.yml` file. The `automatarr` directory contains a `database` directory where `MongoDB` stores its local database, as well as a `logs` directory where all backend logs are stored.

`/:/host_fs` exposes your machine's entire filesystem to Automatarr. If you're not comfortable with this, that's absolutely fine — simply omit it. However, this means Automatarr will not have access to, and therefore cannot manipulate, content outside of what is achievable through API requests.

## To do:

- [ ] Add Sonarr support to Remove Missing - Import List level
- [ ] Allow for deletion of downloading torrents
- [ ] Add stalled or slow torrent download deletion
- [ ] Separate settings page into an API Connections page and Loops page
- [ ] Add graphs for basic data visuals to stats page
- [ ] Add Lidarr support to Remove Missing
- [ ] Add spinner to top right of settings pages or nav bar for more obvious loading
