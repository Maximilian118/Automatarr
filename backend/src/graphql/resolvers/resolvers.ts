import coreResolvers from "./coreResolvers"
import settingsResolvers from "./settingsResolvers"
import statsResolvers from "./statsResolvers"

const Resolvers = {
  ...statsResolvers,
  ...settingsResolvers,
  ...coreResolvers,
}

export default Resolvers
