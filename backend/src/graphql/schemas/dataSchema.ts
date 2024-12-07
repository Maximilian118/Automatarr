const dataSchema = `
  type XY {
    x: String!
    y: Int!
  }

  type NivoData {
    id: String!
    data: [XY!]
  }

  type NivoCharts {
    _id: ID!
    name: String!
    wanted_mising: [NivoData!]
    import_blocked: [NivoData!]
    remove_failed: [NivoData!]
    remove_missing: [NivoData!]
    permissions_change: [NivoData!]
    created_at: String!
    updated_at: String!
  }

  type Data {
    _id: ID!
    nivoCharts: NivoCharts!
    created_at: String!
    updated_at: String!
  }
`
export default dataSchema
