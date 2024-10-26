import mongoose, { Document } from "mongoose"
import moment from "moment"
import { ObjectId } from "mongodb"
import { commandData, DownloadStatus, rootFolderData, unmappedFolders } from "../types"

// A name to categorize each set of commands for a specific API
export type commandsData = {
  name: string
  data: commandData[]
}

// A name to categorize a list of available commands
export type commandList = {
  name: string
  data: string[]
}

// A name to categorize a list of items currently in the download queues
export type downloadQueue = {
  name: string
  data: DownloadStatus[]
}

// A name to categorize the root folder for each API
export type rootFolder = {
  name: string
  data: rootFolderData
}

// Main dataType
export interface dataType extends Document {
  _id: ObjectId
  commands: commandsData[]
  commandList: commandList[]
  downloadQueues: downloadQueue[]
  rootFolders: rootFolder[]
  created_at: string
  updated_at: string
}

// Define the schemas for languages and quality
const LanguageSchema = new mongoose.Schema({
  id: { type: Number, required: true },
  name: { type: String, required: true },
})

const basicQualitySchema = new mongoose.Schema({
  id: { type: Number, required: false },
  name: { type: String, required: false },
})

const qualityRevisionSchema = new mongoose.Schema({
  version: { type: Number, required: false },
  real: { type: Number, required: false },
  isRepack: { type: Boolean, required: false },
})

const qualitySchema = new mongoose.Schema({
  version: { type: Number, required: false },
  real: { type: Number, required: false },
  isRepack: { type: Boolean, required: false },
  quality: { type: basicQualitySchema, required: false },
  revision: { type: qualityRevisionSchema, required: false },
})

const statusMessageSchema = new mongoose.Schema({
  title: { type: String, required: true },
  messages: { type: [String], default: [] },
})

// Base Download Status Schema
const downloadStatusSchema = new mongoose.Schema({
  id: { type: Number, required: true },
  languages: { type: [LanguageSchema], required: true },
  quality: { type: qualitySchema, required: true },
  customFormats: { type: [String], default: [] },
  customFormatScore: { type: Number, default: 0 },
  size: { type: Number, required: true },
  title: { type: String, required: true },
  sizeleft: { type: Number, required: true },
  timeleft: { type: String, required: true },
  estimatedCompletionTime: { type: String, required: true },
  added: { type: String, required: true },
  status: { type: String, required: true },
  trackedDownloadStatus: { type: String, required: true },
  trackedDownloadState: { type: String, required: true },
  statusMessages: { type: [statusMessageSchema], default: [] },
  downloadId: { type: String, required: true },
  protocol: { type: String, required: true },
  downloadClient: { type: String, required: true },
  downloadClientHasPostImportCategory: { type: Boolean, required: true },
  indexer: { type: String, required: true },
  movieId: { type: Number, required: false }, // Radarr
  seriesId: { type: Number, required: false }, // Sonarr
  episodeId: { type: Number, required: false }, // Sonarr
  seasonNumber: { type: Number, required: false }, // Sonarr
  errorMessage: { type: String, default: "" }, // Sonarr
  outputPath: { type: String, required: false }, // Sonarr
  episodeHasFile: { type: Boolean, required: false }, // Sonarr
  artistId: { type: Number, required: false }, // Lidarr
  albumId: { type: Number, required: false }, // Lidarr
  trackFileCount: { type: Number, required: false }, // Lidarr
  trackHasFileCount: { type: Number, required: false }, // Lidarr
  downloadForced: { type: Boolean, required: false }, // Lidarr
})

// commandData Mongoose Schema
const commandSchema = new mongoose.Schema<commandData>({
  name: { type: String, required: true },
  commandName: { type: String, required: true },
  body: { type: Object, required: true },
  priority: { type: String, required: true },
  status: {
    type: String,
    enum: ["queued", "started", "completed", "failed", "aborted"],
    required: true,
  },
  result: { type: String, required: true },
  queued: { type: String, required: true },
  started: { type: String },
  ended: { type: String },
  duration: { type: String },
  trigger: { type: String, required: true },
  stateChangeTime: { type: String, required: true },
  sendUpdatesToClient: { type: Boolean, required: true },
  updateScheduledTask: { type: Boolean, required: true },
  lastExecutionTime: { type: String },
  id: { type: Number, required: true },
})

// Define the unmappedFolders schema
const unmappedFoldersSchema = new mongoose.Schema<unmappedFolders>({
  name: { type: String, required: true }, // The name of the unmapped folder
  path: { type: String, required: true }, // The full path of the unmapped folder
  relativePath: { type: String, required: true }, // The relative path of the unmapped folder
})

// Define the rootFolderData schema
const rootFolderDataSchema = new mongoose.Schema<rootFolderData>({
  id: { type: Number, required: true }, // An identifier for the root folder
  name: { type: String, required: false }, // Optional name for the root folder
  path: { type: String, required: true }, // The path of the root folder
  accessible: { type: Boolean, required: true }, // Whether the root folder is accessible
  freeSpace: { type: Number, required: true }, // The amount of free space in the root folder
  totalSpace: { type: Number, required: false }, // Optional total space of the root folder
  defaultTags: { type: [Number], required: false }, // Optional array of default tags (numbers)
  unmappedFolders: { type: [unmappedFoldersSchema], default: [] }, // Optional array of unmapped folders
  defaultNewItemMonitorOption: { type: String, required: false }, // Optional default new item monitor option
  defaultMonitorOption: { type: String, required: false }, // Optional default monitor option
  defaultQualityProfileId: { type: Number, required: false }, // Optional default quality profile ID
  defaultMetadataProfileId: { type: Number, required: false }, // Optional default metadata profile ID
})

const commandsSchema = new mongoose.Schema<commandsData>({
  name: { type: String, required: true },
  data: { type: [commandSchema], required: true }, // Array of commandData
})

const commandListSchema = new mongoose.Schema<commandList>({
  name: { type: String, required: true },
  data: { type: [String], required: true }, // Array of commandData
})

const downloadQueuesSchema = new mongoose.Schema<downloadQueue>({
  name: { type: String, required: true },
  data: { type: [downloadStatusSchema], required: true }, // Array of download statuses
})

const rootFoldersSchema = new mongoose.Schema<rootFolder>({
  name: { type: String, required: true },
  data: { type: rootFolderDataSchema, required: true }, // The root folder directory
})

// Data Mongoose Schema
const dataSchema = new mongoose.Schema<dataType>({
  commands: { type: [commandsSchema], default: [] },
  commandList: { type: [commandListSchema], default: [] },
  downloadQueues: { type: [downloadQueuesSchema], default: [] },
  rootFolders: { type: [rootFoldersSchema], default: [] },
  created_at: { type: String, default: moment().format() },
  updated_at: { type: String, default: moment().format() },
})

// Data Model
const Data = mongoose.model<dataType>("Data", dataSchema)
export default Data
