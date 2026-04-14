const importListSchema = `
  type ImportListField {
    order: Int
    name: String
    label: String
    helpText: String
    value: String
    type: String
    advanced: Boolean
    privacy: String
    isFloat: Boolean
  }

  type ImportListItem {
    id: Int!
    enabled: Boolean
    enableAuto: Boolean
    monitor: String
    searchOnAdd: Boolean
    minimumAvailability: String
    enableAutomaticAdd: Boolean
    searchForMissingEpisodes: Boolean
    shouldMonitor: String
    monitorNewItems: String
    seriesType: String
    seasonFolder: Boolean
    rootFolderPath: String!
    qualityProfileId: Int!
    listType: String
    listOrder: Int
    minRefreshInterval: String
    name: String!
    fields: [ImportListField!]
    implementationName: String
    implementation: String
    configContract: String
    infoLink: String
    tags: [Int]
  }

  type ImportList {
    name: String!
    data: [ImportListItem!]!
  }

  type ImportListReturn {
    data: [ImportList!]!
    tokens: [String!]!
  }

  type ImportListMutationReturn {
    success: Boolean!
    importList: ImportListItem
    tokens: [String!]!
  }

  type RootFolderPaths {
    name: String!
    paths: [String!]!
  }

  type RootFolderPathsReturn {
    data: [RootFolderPaths!]!
    tokens: [String!]!
  }

  input ImportListFieldInput {
    order: Int
    name: String
    label: String
    helpText: String
    value: String
    type: String
    advanced: Boolean
    privacy: String
    isFloat: Boolean
  }

  input ImportListCreateInput {
    apiName: String!
    name: String!
    url: String!
    enabled: Boolean
    qualityProfileId: Int!
    rootFolderPath: String!
    searchOnAdd: Boolean
    minimumAvailability: String
    monitor: String
    shouldMonitor: String
    monitorNewItems: String
    seriesType: String
    seasonFolder: Boolean
    tags: [Int]
  }

  input ImportListUpdateInput {
    apiName: String!
    id: Int!
    name: String
    url: String
    enabled: Boolean
    qualityProfileId: Int
    rootFolderPath: String
    searchOnAdd: Boolean
    minimumAvailability: String
    monitor: String
    shouldMonitor: String
    monitorNewItems: String
    seriesType: String
    seasonFolder: Boolean
    tags: [Int]
  }

  input ImportListDeleteInput {
    apiName: String!
    id: Int!
  }

  input ImportListTestInput {
    apiName: String!
    id: Int
    name: String!
    url: String!
    qualityProfileId: Int!
    rootFolderPath: String!
    searchOnAdd: Boolean
  }

  type ImportListStats {
    listId: Int!
    total: Int!
    downloaded: Int!
    downloading: Int!
    missing: Int!
    sizeOnDisk: Float!
    error: Boolean!
    errorMessage: String
  }

  type ImportListApiStats {
    name: String!
    stats: [ImportListStats!]!
  }

  type ImportListStatsReturn {
    data: [ImportListApiStats!]!
    tokens: [String!]!
  }
`
export default importListSchema
