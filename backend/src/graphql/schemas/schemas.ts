import { buildSchema } from "graphql"
import statsSchema from "./statsSchema"
import settingsSchema from "./settingsSchema"

const Schema = buildSchema(`
  ${statsSchema}
  ${settingsSchema}

  type RootQuery {
    getStats: Stats
    getSettings: Settings
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
