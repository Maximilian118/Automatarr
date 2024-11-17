import { Artist } from "./artistTypes"
import { Episode } from "./episodeTypes"
import { Movie } from "./movieTypes"
import { qBittorrentPreferences, Torrent, TorrentCategory } from "./qBittorrentTypes"
import { Series } from "./seriesTypes"
import { commandData, DownloadStatus, rootFolderData } from "./types"

export interface baseData {
  name: string
  created_at: string
  updated_at: string
}

// A name to categorize each set of commands for a specific API
export interface commandsData extends baseData {
  data: commandData[]
}

// A name to categorize a list of available commands
export interface commandList extends baseData {
  data: string[]
}

// A name to categorize a list of items currently in the download queues
export interface downloadQueue extends baseData {
  data: DownloadStatus[]
}

// A name to categorize the root folder for each API
export interface rootFolder extends baseData {
  data: rootFolderData
}

// A name to categorize each library
export interface library extends baseData {
  data: (Movie | Series | Artist)[]
  subData?: Episode[] // Sonarr Episodes
}

// An object with qBittorrent data
export interface qBittorrent extends baseData {
  cookie: string
  torrents: Torrent[]
  categories: TorrentCategory[]
  preferences: qBittorrentPreferences
}

// Main dataType
export interface dataType {
  _id: string
  commands: commandsData[]
  commandList: commandList[]
  downloadQueues: downloadQueue[]
  rootFolders: rootFolder[]
  libraries: library[]
  missingWanteds: library[]
  qBittorrent: qBittorrent
  created_at: string
  updated_at: string
}
