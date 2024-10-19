import settingsResolvers from "./settingsResolvers"
import statsResolvers from "./statsResolvers"

const Resolvers = {
  ...statsResolvers,
  ...settingsResolvers,
}

export default Resolvers
