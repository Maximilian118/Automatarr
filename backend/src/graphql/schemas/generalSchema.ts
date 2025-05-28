const generalSchema = `
  type Language {
    id: Int!
    name: String!
  }

  type BasicQuality {
    id: Int!
    name: String!
    source: String!
    resolution: Int!
  }

  type QualityRevision {
    version: Int!
    real: Int!
    isRepack: Boolean!
  }

  type Quality {
    quality: BasicQuality!
    version: Int
    real: Int
    isRepack: Boolean
    revision: QualityRevision!
  }
`
export default generalSchema
