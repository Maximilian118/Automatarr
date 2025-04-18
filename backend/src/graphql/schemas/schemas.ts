import { buildSchema } from "graphql"
import settingsSchema from "./settingsSchema"
import dataSchema from "./dataSchema"

const Schema = buildSchema(`
  ${settingsSchema}
  ${dataSchema}

  type RootQuery {
    getSettings: Settings
    getData: Data
    getChildPaths(path: String): [String!]!
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
