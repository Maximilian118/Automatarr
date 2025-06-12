import { buildSchema } from "graphql"
import settingsSchema from "./settingsSchema"
import dataSchema from "./dataSchema"
import generalSchema from "./generalSchema"
import qBittorrentSchema from "./qBittorrentSchema"
import movieSchema from "./movieSchema"
import seriesSchema from "./seriesSchema"
import episodeSchema from "./episodeSchema"
import qualityProfileSchema from "./qualityProfileSchema"
import checkSchema from "./checkSchema"
import miscSchema from "./miscSchema"
import userSchema from "./userSchema"

const Schema = buildSchema(`
  ${miscSchema}
  ${checkSchema}
  ${generalSchema}
  ${qBittorrentSchema}
  ${movieSchema}
  ${episodeSchema}
  ${seriesSchema}
  ${qualityProfileSchema}
  ${settingsSchema}
  ${dataSchema}
  ${userSchema}

  type RootQuery {
    login(name: String!, password: String!): User!
    forgot(recovery_key: String!): User!
    getSettings: Settings
    getChildPaths(path: String): StringArr!
    getDiscordChannels(server_name: String!): StringArr!
    getQualityProfiles: QPReturn!
    checkRadarr(URL: String, KEY: String): CheckStatus!
    checkSonarr(URL: String, KEY: String): CheckStatus!
    checkLidarr(URL: String, KEY: String): CheckStatus!
    checkqBittorrent(URL: String, USER: String, PASS: String): CheckStatus!
    checkUnixUsers: StringArr!
    checkUnixGroups: StringArr!
  }

  type RootMutation {
    createUser(name: String!, password: String!): User!
    updateSettings(settingsInput: settingsInput): Settings
  }

  schema {
    query: RootQuery
    mutation: RootMutation
  }
`)

export default Schema
