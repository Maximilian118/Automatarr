const activitySchema = `
  type Activity {
    _id: ID!
    at: String!
    source: String!
    action: String!
    app: String
    title: String!
    path: String
    bytes: Float
    reason: String
  }

  type ActivitySource {
    source: String!
    count: Int!
  }

  type ActivityPage {
    items: [Activity!]!
    next: String
    sources: [ActivitySource!]!
    tokens: [String!]
  }
`

export default activitySchema
