import mongoose, { Document } from "mongoose"
import { ObjectId } from "mongodb"
import { Movie } from "../types/movieTypes"
import { Season, Series } from "../types/seriesTypes"
import { Episode } from "../types/episodeTypes"
import { AvailableBots } from "./settings"

export type EventType =
  | "Test"
  | "Download" // Turns into "Import" or "Upgrade" based on the starrWebhookEventType() return
  | "Grab"
  | "MovieAdded"
  | "MovieDelete"
  | "MovieFileDelete"
  | "SeriesAdd"
  | "SeriesDelete"
  | "EpisodeFileDelete"
  | "Import" // Not actually an eventType from Starr apps. Returned from starrWebhookEventType()
  | "Upgrade" // Not actually an eventType from Starr apps. Returned from starrWebhookEventType()

export interface DiscordDataType {
  _id?: string
  guildId: string
  channelId: string
  authorId: string
  authorUsername: string
  authorMention: string
  messageId: string
}

export interface BasicEpisodeDataType {
  seasonNumber: number
  episodeNumber: number
  imported: boolean // Has this episode had a webhook "Imported" notification?
}

export interface WebHookWaitingType {
  _id?: ObjectId
  APIName: "Radarr" | "Sonarr" | "Lidarr" // Name of the app the webhook should come from
  bots: AvailableBots[] // Bots to send the message to
  discordData: DiscordDataType | null // All the data discord needs to send a message
  whatsappData: null // All the data whatsapp needs to send a message
  content: Movie | Series | Episode // What is the topic
  seasons: Season[] // Season data for the series populated upon first webhook notification
  episodes: BasicEpisodeDataType[] // An array of all the episodes in the series with data to check if they've been imported
  waitForStatus: EventType // Status are we waiting for
  message: string // Message for the user
  expiry?: Date | null // Time that we stop waiting for a webhook that matches
  expired_message?: string // Message to send if we stop waiting for a webhook that matches
  created_at: Date
}

export interface WebHookType {
  _id: ObjectId
  waiting: WebHookWaitingType[] // An array of object that detremine what webhooks we're waiting for to then send a notification about
  created_at: Date
  updated_at: Date
}

export interface WebHookDocType extends WebHookType, Document {
  _id: ObjectId
  _doc: WebHookType
}

const DiscordDataSchema = new mongoose.Schema<DiscordDataType>({
  guildId: { type: String, required: true },
  channelId: { type: String, required: true },
  authorId: { type: String, required: true },
  authorUsername: { type: String, required: true },
  authorMention: { type: String, required: true },
  messageId: { type: String, required: true },
})

const WebHookWaitingSchema = new mongoose.Schema<WebHookWaitingType>({
  APIName: { type: String, required: true },
  bots: { type: [String], required: true },
  discordData: { type: DiscordDataSchema, required: false },
  whatsappData: { type: mongoose.Schema.Types.Mixed, required: false },
  content: { type: mongoose.Schema.Types.Mixed, required: true },
  seasons: { type: mongoose.Schema.Types.Mixed, default: [] },
  episodes: { type: mongoose.Schema.Types.Mixed, default: [] },
  waitForStatus: { type: String, required: true },
  message: { type: String, required: true },
  expiry: { type: Date, default: null },
  expired_message: { type: String, default: "" },
  created_at: { type: Date, default: Date.now },
})

const webHookSchema = new mongoose.Schema<WebHookType>(
  {
    waiting: { type: [WebHookWaitingSchema], default: [] },
  },
  {
    timestamps: {
      createdAt: "created_at",
      updatedAt: "updated_at",
    },
    optimisticConcurrency: true,
  },
)

// Helpful indexes
webHookSchema.index({ "waiting.content.tmdbId": 1, "waiting.status": 1 })
webHookSchema.index({ "waiting.APIName": 1 })
webHookSchema.index({ "waiting.added_by.channel_id": 1 })

const WebHook = mongoose.model<WebHookType>("WebHook", webHookSchema)

export default WebHook
