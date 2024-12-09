// Population fields for a settings request
export const populateSettings = `
  _id
  radarr_URL
  radarr_KEY
  radarr_API_version
  radarr_active
  sonarr_URL
  sonarr_KEY
  sonarr_API_version
  sonarr_active
  lidarr_URL
  lidarr_KEY
  lidarr_API_version
  lidarr_active
  import_blocked
  wanted_missing
  remove_failed
  remove_missing
  permissions_change
  import_blocked_loop
  wanted_missing_loop
  remove_failed_loop
  remove_missing_loop
  remove_missing_level
  permissions_change_loop
  permissions_change_chown
  permissions_change_chmod
  qBittorrent_URL
  qBittorrent_username
  qBittorrent_password
  qBittorrent_active
  qBittorrent_API_version
  created_at
  updated_at
`

export const populateData = `
  _id
  nivoCharts {
    name
    wanted_mising {
      id
      data {
        x
        y
      }
    }
    import_blocked {
      id
      data {
        x
        y
      }
    }
    remove_failed {
      id
      data {
        x
        y
      }
    }
    remove_missing {
      id
      data {
        x
        y
      }
    }
    permissions_change {
      id
      data {
        x
        y
      }
    }
  }
  created_at
  updated_at
`
