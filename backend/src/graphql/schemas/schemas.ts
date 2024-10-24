import { buildSchema } from "graphql"
import statsSchema from "./statsSchema"
import settingsSchema from "./settingsSchema"
import dataSchema from "./dataSchema"

const Schema = buildSchema(`
  ${statsSchema}
  ${settingsSchema}
  ${dataSchema}

  type RootQuery {
    getStats: Stats
    getSettings: Settings
    getData: Data
    checkRadarr: Int!
    checkSonarr: Int!
    checkLidarr: Int!
    checkNewRadarr(URL: String!, KEY: String!): Int!
    checkNewSonarr(URL: String!, KEY: String!): Int!
    checkNewLidarr(URL: String!, KEY: String!): Int!
  }

  type RootMutation {
    newStats: Stats
    updateStats(statsInput: statsInput): Stats
    newSettings: Settings
    updateSettings(settingsInput: settingsInput): Settings
  }

  schema {
    query: RootQuery
    mutation: RootMutation
  }
`)

export default Schema
