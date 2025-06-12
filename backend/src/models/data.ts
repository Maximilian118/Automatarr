import mongoose, { Document } from "mongoose"
import moment from "moment"
import { ObjectId } from "mongodb"
import { commandData, DownloadStatus, ImportListData, rootFolderData } from "../types/types"
import { Movie } from "../types/movieTypes"
import { Series } from "../types/seriesTypes"
import { Artist } from "../types/artistTypes"
import { Episode } from "../types/episodeTypes"
import { qBittorrentPreferences, Torrent, TorrentCategory } from "../types/qBittorrentTypes"
import { QualityProfile } from "../types/qualityProfileType"

export interface baseData {
  name: "Radarr" | "Sonarr" | "Lidarr" | "qBittorrent"
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

// A name to categorize a list of import lists
export interface importList extends baseData {
  data: ImportListData[]
}

// A name to categorize the root folder for each API
export interface rootFolder extends baseData {
  data: rootFolderData
}

// A name to categorize the root folder for each API
export interface qualityProfile extends baseData {
  data: QualityProfile[]
}

// A name to categorize each library
export interface library extends baseData {
  data: (Movie | Series | Artist)[]
  subData?: Episode[] // Sonarr Episodes
}

// An object with qBittorrent data
export interface qBittorrent extends baseData {
  cookie: string
  cookie_expiry: string
  torrents: Torrent[]
  categories: TorrentCategory[]
  preferences: qBittorrentPreferences
}

// Main dataType
export interface dataType {
  _id: ObjectId
  commands: commandsData[]
  commandList: commandList[]
  downloadQueues: downloadQueue[]
  importLists: importList[]
  rootFolders: rootFolder[]
  qualityProfiles: qualityProfile[]
  libraries: library[]
  missingWanteds: library[]
  qBittorrent: qBittorrent
  created_at: string
  updated_at: string
  tokens: string[] // Tokens to be sent in resolver return for session data.
  [key: string]: any
}

// Data object from MongoDB Database
export interface dataDocType extends dataType, Document {
  _id: ObjectId
  _doc: dataType
}

// Define the base schema with common fields
const baseSchema = {
  name: { type: String, required: true },
  created_at: { type: String, default: moment().format() },
  updated_at: { type: String, default: moment().format() },
}

// Define individual schemas by using base schema fields and adding specific fields
const commandsSchema = new mongoose.Schema<commandsData>({
  ...baseSchema,
  data: { type: mongoose.Schema.Types.Mixed, required: true }, // Array of commandData
})

const commandListSchema = new mongoose.Schema<commandList>({
  ...baseSchema,
  data: { type: [String], required: true }, // Array of commandData
})

const downloadQueuesSchema = new mongoose.Schema<downloadQueue>({
  ...baseSchema,
  data: { type: mongoose.Schema.Types.Mixed, required: true }, // Array of download statuses
})

const importListSchema = new mongoose.Schema<importList>({
  ...baseSchema,
  data: { type: mongoose.Schema.Types.Mixed, required: true }, // Array of import lists
})

const rootFoldersSchema = new mongoose.Schema<rootFolder>({
  ...baseSchema,
  data: { type: mongoose.Schema.Types.Mixed, required: true }, // The root folder directory
})

const qualityProfilesSchmea = new mongoose.Schema<qualityProfile>({
  ...baseSchema,
  data: { type: mongoose.Schema.Types.Mixed, required: true }, // Array of quality profiles
})

const librariesSchema = new mongoose.Schema<library>({
  ...baseSchema,
  data: { type: mongoose.Schema.Types.Mixed, required: true }, // No limitations on the structure
  subData: { type: mongoose.Schema.Types.Mixed, required: false }, // No limitations on the structure
})

const qBittorrentSchema = new mongoose.Schema<qBittorrent>({
  ...baseSchema,
  cookie: { type: String, default: "" },
  cookie_expiry: { type: String, default: "" },
  torrents: { type: mongoose.Schema.Types.Mixed, default: [] },
  categories: { type: mongoose.Schema.Types.Mixed, default: [] },
  preferences: { type: mongoose.Schema.Types.Mixed, default: {} },
})

const initqBittorrent: qBittorrent = {
  name: "qBittorrent",
  created_at: moment().format(),
  updated_at: moment().format(),
  cookie: "",
  cookie_expiry: "",
  torrents: [],
  categories: [],
  preferences: {} as qBittorrentPreferences,
}

// Data Mongoose Schema
const dataSchema = new mongoose.Schema<dataType>({
  commands: { type: [commandsSchema], default: [] },
  commandList: { type: [commandListSchema], default: [] },
  downloadQueues: { type: [downloadQueuesSchema], default: [] },
  importLists: { type: [importListSchema], default: [] },
  rootFolders: { type: [rootFoldersSchema], default: [] },
  qualityProfiles: { type: [qualityProfilesSchmea], default: [] },
  libraries: { type: [librariesSchema], default: [] },
  missingWanteds: { type: [librariesSchema], default: [] },
  qBittorrent: { type: qBittorrentSchema, default: initqBittorrent },
  created_at: { type: String, default: moment().format() },
  updated_at: { type: String, default: moment().format() },
})

// Data Model
const Data = mongoose.model<dataType>("Data", dataSchema)
export default Data
