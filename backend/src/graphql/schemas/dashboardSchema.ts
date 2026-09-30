const dashboardSchema = `
  type LoopStatus {
    name: String!
    active: Boolean!
    running: Boolean!
    interval_mins: Float
    first_ran: String
    last_ran: String
    next_run: String
    deletions_24h: Int!
  }

  type LoopStatusResult {
    loops: [LoopStatus!]!
    tokens: [String!]
  }

  type Arrival {
    type: String!
    title: String!
    year: Int
    poster: String
    added: String!
    tmdbId: Int
  }

  type RecentArrivalsResult {
    items: [Arrival!]!
    tokens: [String!]
  }
`

export default dashboardSchema
