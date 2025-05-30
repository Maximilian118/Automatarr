const qualityProfileSchema = `
  type QualityProfile {
    name: String!
    data: [QualityProfileData!]!
  }

  type QualityProfileData {
    id: Int!
    name: String!
    upgradeAllowed: Boolean!
    cutoff: Int!
    items: [QualityProfileItem!]!
    minFormatScore: Int!
    cutoffFormatScore: Int!
    minUpgradeFormatScore: Int!
    formatItems: [QPFormatItem!]!
    language: QPLanguage!
  }

  type QualityProfileItem {
    id: Int!
    name: String!
    quality: QPQuality!
    items: [String!]!
    allowed: Boolean!
  }

  type QPQuality {
    id: Int!
    name: String!
    source: String!
    resolution: Int!
    modifier: String!
  }

  type QPFormatItem {
    id: Int!
    format: Int!
    name: String!
    score: Int!
  }

  type QPLanguage {
    id: Int!
    name: String!
  }
`
export default qualityProfileSchema
