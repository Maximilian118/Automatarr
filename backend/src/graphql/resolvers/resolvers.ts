import checkResolvers from "./checkResolvers"
import coreResolvers from "./coreResolvers"
import settingsResolvers from "./settingsResolvers"
import statsResolvers from "./statsResolvers"

const Resolvers = {
  ...statsResolvers,
  ...settingsResolvers,
  ...coreResolvers,
  ...checkResolvers,
}

export default Resolvers
