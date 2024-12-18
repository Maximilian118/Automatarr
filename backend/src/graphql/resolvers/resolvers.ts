import checkResolvers from "./checkResolvers"
import coreResolvers from "./coreResolvers"
import dataResolvers from "./dataResolvers"
import miscResolvers from "./miscResolvers"
import settingsResolvers from "./settingsResolvers"

const Resolvers = {
  ...settingsResolvers,
  ...coreResolvers,
  ...checkResolvers,
  ...dataResolvers,
  ...miscResolvers,
}

export default Resolvers
