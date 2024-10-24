import mongoose from "mongoose"
import moment from "moment"
import { ObjectId } from "mongodb"

// All of the data for a single command retrieved from the backend
export type commandData = {
  name: string
  commandName: string
  body: Record<string, any>
  priority: string
  status: "queued" | "started" | "completed" | "failed" | "aborted"
  result: string
  queued: string
  started?: string
  ended?: string
  duration?: string
  trigger: string
  stateChangeTime: string
  sendUpdatesToClient: boolean
  updateScheduledTask: boolean
  lastExecutionTime?: string
  id: number
}

// A name to catagorise each set of commands for a specific API
export type commandsData = {
  name: string
  data: commandData[]
}

// Main dataType
export interface dataType {
  _id: ObjectId
  commands: commandsData[]
  created_at: string
  updated_at: string
  _doc: dataType
}

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

// commandsData Mongoose Schema
const commandsSchema = new mongoose.Schema<commandsData>({
  name: { type: String, required: true },
  data: { type: [commandSchema], required: true }, // Array of commandData
})

// Data Mongoose Schema
const dataSchema = new mongoose.Schema<dataType>({
  commands: { type: [commandsSchema], default: [] },
  created_at: { type: String, default: moment().format() },
  updated_at: { type: String, default: moment().format() },
})

// Data Model
const Data = mongoose.model<dataType>("Data", dataSchema)

export default Data
