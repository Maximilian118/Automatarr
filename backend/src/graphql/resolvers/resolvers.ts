import checkResolvers from "./checkResolvers"
import dataResolvers from "./dataResolvers"
import miscResolvers from "./miscResolvers"
import settingsResolvers from "./settingsResolvers"
import userResolvers from "./userResolvers"
import statsResolvers from "./statsResolvers"

const Resolvers = {
  ...settingsResolvers,
  ...checkResolvers,
  ...dataResolvers,
  ...miscResolvers,
  ...userResolvers,
  ...statsResolvers,
}

export default Resolvers
