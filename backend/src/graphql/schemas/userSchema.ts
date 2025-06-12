const userSchema = `
  type User {
    _id: ID!
    name: String!
    password: String!
    password_check: String
    refresh_count: Int!
    admin: Boolean!
    email: String
    icon: String
    profile_picture: String
    logged_in_at: String!
    created_at: String!
    updated_at: String!
    tokens: [String!]!
    recovery_key: String
  }

  input userInput {
    name: String
    password: String
    password_check: String
  }
`
export default userSchema
