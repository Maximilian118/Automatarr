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
         - "8090:8090"
   ```
