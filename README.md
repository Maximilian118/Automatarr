_Like this app? Thanks for giving it a_ ⭐️

# **Automatarr**

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
      # - VITE_BACKEND_IP=192.168.1.2 # Optional
      # - VITE_BACKEND_PORT=8091 # Optional
      # - VITE_DATABASE_IP=172.0.0.2 # Optional
      # - VITE_DATABASE_PORT=27020 # Optional
```

2. `docker-compose pull`
3. `docker-compose up -d`

If successful and the application is running, a directory named `automatarr` will be created alongside the `docker-compose.yml` file. The `automatarr` directory contains a `database` directory where `MongoDB` stores its local database, as well as a `logs` directory where all backend logs are stored.

`/:/host_fs` exposes your machine's entire filesystem to Automatarr. If you're not comfortable with this, that's absolutely fine — simply omit it. However, this means Automatarr will not have access to, and therefore cannot manipulate, content outside of what is achievable through API requests.
