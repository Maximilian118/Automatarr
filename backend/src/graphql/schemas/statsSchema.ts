const statsSchema = `
  type Stats {
    _id: ID!
    radarr_total: [Int!]
    radarr_queue: [Int!]
    radarr_missing: [Int!]
    sonarr_total: [Int!]
    sonarr_queue: [Int!]
    sonarr_missing: [Int!]
    lidarr_total: [Int!]
    lidarr_queue: [Int!]
    lidarr_missing: [Int!]
    created_at: String!
    updated_at: String!
  }

  input statsInput {
    _id: ID!
    radarr_total: [Int!]
    radarr_queue: [Int!]
    radarr_missing: [Int!]
    sonarr_total: [Int!]
    sonarr_queue: [Int!]
    sonarr_missing: [Int!]
    lidarr_total: [Int!]
    lidarr_queue: [Int!]
    lidarr_missing: [Int!]
  }
`
export default statsSchema
