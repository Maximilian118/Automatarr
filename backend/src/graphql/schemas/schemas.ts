import { buildSchema } from "graphql"
import settingsSchema from "./settingsSchema"
import dataSchema from "./dataSchema"
import generalSchema from "./generalSchema"
import qBittorrentSchema from "./qBittorrentSchema"
import movieSchema from "./movieSchema"
import seriesSchema from "./seriesSchema"
import episodeSchema from "./episodeSchema"
import qualityProfileSchema from "./qualityProfileSchema"

const Schema = buildSchema(`
  ${generalSchema}
  ${qBittorrentSchema}
  ${movieSchema}
  ${episodeSchema}
  ${seriesSchema}
  ${qualityProfileSchema}
  ${settingsSchema}
  ${dataSchema}

  type RootQuery {
    getSettings: Settings
    getData: Data
    getChildPaths(path: String): [String!]!
    getDiscordChannels(server_name: String!): [String!]!
    getQualityProfiles: [QualityProfile!]!
    checkRadarr: Int!
    checkSonarr: Int!
    checkLidarr: Int!
    checkqBittorrent: Int!
    checkNewRadarr(URL: String!, KEY: String!): Int!
    checkNewSonarr(URL: String!, KEY: String!): Int!
    checkNewLidarr(URL: String!, KEY: String!): Int!
    checkNewqBittorrent(URL: String!, USER: String!, PASS: String!): Int!
    checkUsers: [String!]
    checkGroups: [String!]
  }

  type RootMutation {
    newSettings: Settings
    updateSettings(settingsInput: settingsInput): Settings
  }

  schema {
    query: RootQuery
    mutation: RootMutation
  }
`)

export default Schema
