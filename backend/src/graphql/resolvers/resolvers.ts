import checkResolvers from "./checkResolvers"
import coreResolvers from "./coreResolvers"
import dataResolvers from "./dataResolvers"
import settingsResolvers from "./settingsResolvers"
import statsResolvers from "./statsResolvers"

const Resolvers = {
  ...statsResolvers,
  ...settingsResolvers,
  ...coreResolvers,
  ...checkResolvers,
  ...dataResolvers,
}

export default Resolvers
