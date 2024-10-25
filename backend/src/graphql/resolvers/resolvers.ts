import checkResolvers from "./checkResolvers"
import coreResolvers from "./coreResolvers"
import dataResolvers from "./dataResolvers"
import settingsResolvers from "./settingsResolvers"

const Resolvers = {
  ...settingsResolvers,
  ...coreResolvers,
  ...checkResolvers,
  ...dataResolvers,
}

export default Resolvers
