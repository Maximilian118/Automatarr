import checkResolvers from "./checkResolvers"
import dataResolvers from "./dataResolvers"
import miscResolvers from "./miscResolvers"
import settingsResolvers from "./settingsResolvers"
import userResolvers from "./userResolvers"

const Resolvers = {
  ...settingsResolvers,
  ...checkResolvers,
  ...dataResolvers,
  ...miscResolvers,
  ...userResolvers,
}

export default Resolvers
