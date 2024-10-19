const statsSchema = `
  type Stats {
    _id: String!
    Radarr_total: [Int!]
    Radarr_queue: [Int!]
    Radarr_missing: [Int!]
    Sonarr_total: [Int!]
    Sonarr_queue: [Int!]
    Sonarr_missing: [Int!]
    Lidarr_total: [Int!]
    Lidarr_queue: [Int!]
    Lidarr_missing: [Int!]
    created_at: String!
    updated_at: String!
  }

  input statsInput {
    _id: String!
    Radarr_total: [Int!]
    Radarr_queue: [Int!]
    Radarr_missing: [Int!]
    Sonarr_total: [Int!]
    Sonarr_queue: [Int!]
    Sonarr_missing: [Int!]
    Lidarr_total: [Int!]
    Lidarr_queue: [Int!]
    Lidarr_missing: [Int!]
  }
`
export default statsSchema
