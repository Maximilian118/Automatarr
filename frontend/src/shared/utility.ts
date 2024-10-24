import { settingsType } from "./types"
import { checkLidarr, checkRadarr, checkSonarr } from "./requests/checkAPIRequests"

// Check the status of each API
export const checkAPIs = async (
  settings: settingsType,
  newCredentials?: true,
): Promise<settingsType> => {
  const [radarr_active, sonarr_active, lidarr_active] = await Promise.all([
    checkRadarr(newCredentials && settings),
    checkSonarr(newCredentials && settings),
    checkLidarr(newCredentials && settings),
  ])

  return {
    ...settings,
    radarr_active,
    sonarr_active,
    lidarr_active,
  }
}
