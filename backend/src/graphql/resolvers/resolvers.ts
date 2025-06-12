import checkResolvers from "./checkResolvers"
import coreResolvers from "./coreResolvers"
import dataResolvers from "./dataResolvers"
import miscResolvers from "./miscResolvers"
import settingsResolvers from "./settingsResolvers"
import userResolvers from "./userResolvers"

const Resolvers = {
  ...settingsResolvers,
  ...coreResolvers,
  ...checkResolvers,
  ...dataResolvers,
  ...miscResolvers,
  ...userResolvers,
}

export default Resolvers
