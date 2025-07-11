import { dataDocType } from "../models/data"
import { settingsDocType } from "../models/settings"
import { UserDocType } from "../models/user"
import { WebHookDocType } from "../models/webhook"
import { Artist } from "./artistTypes"
import { Episode } from "./episodeTypes"
import { Movie } from "./movieTypes"
import { Series } from "./seriesTypes"

// Type Guard to check if type is Movie
export const isMovie = (item: Movie | Series | Artist | Episode): item is Movie => {
  return (item as Movie).movieFileId !== undefined
}

// Type Guard to check if type is Series
export const isSeries = (item: Movie | Series | Artist | Episode): item is Series => {
  return (item as Series).seasonFolder !== undefined
}

// Type Guard to check if type is Artist
export const isArtist = (item: Movie | Series | Artist | Episode): item is Artist => {
  return (item as Artist).artistName !== undefined
}

// Type Guard to check if type is Episode
export const isEpisode = (item: Movie | Series | Artist | Episode): item is Episode => {
  return (item as Episode).episodeNumber !== undefined
}

// Type Guard to check if type is dataDocType
export const isDataDoc = (obj: any): obj is dataDocType => {
  return (
    obj &&
    Array.isArray(obj.commands) &&
    Array.isArray(obj.libraries) &&
    obj.qBittorrent &&
    typeof obj.updated_at === "string" &&
    typeof obj.created_at === "string"
  )
}

// Type Guard to check if type is settingsDocType
export const isSettingsDoc = (obj: any): obj is settingsDocType => {
  return obj?.radarr_URL !== undefined && "discord_bot" in obj
}

// Type Guard to check if type is UserDocType
export const isUserDoc = (obj: any): obj is UserDocType => {
  return obj?.jwt_access_secret !== undefined && "refresh_count" in obj
}

// Type Guard to check if type is WebHookDocType
export const isWebHookDoc = (obj: any): obj is WebHookDocType => {
  return obj?.waiting !== undefined && Array.isArray(obj.waiting)
}
