const dataSchema = `
  type Command {
    name: String!
    commandName: String!
    body: String!
    priority: String!
    status: String!
    result: String!
    queued: String!
    started: String
    ended: String
    duration: String
    trigger: String!
    stateChangeTime: String!
    sendUpdatesToClient: Boolean!
    updateScheduledTask: Boolean!
    lastExecutionTime: String
    id: Int!
  }

  type Commands {
    name: String!
    data: [Command!]!
  }

  type Data {
    _id: ID!
    commands: [Commands!]!
    created_at: String!
    updated_at: String!
  }
`
export default dataSchema
