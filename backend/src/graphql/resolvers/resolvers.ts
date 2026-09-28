import checkResolvers from "./checkResolvers"
import dataResolvers from "./dataResolvers"
import importListResolvers from "./importListResolvers"
import miscResolvers from "./miscResolvers"
import settingsResolvers from "./settingsResolvers"
import userResolvers from "./userResolvers"
import statsResolvers from "./statsResolvers"
import aiResolvers from "./aiResolvers"

const Resolvers = {
  ...settingsResolvers,
  ...checkResolvers,
  ...dataResolvers,
  ...importListResolvers,
  ...miscResolvers,
  ...userResolvers,
  ...statsResolvers,
  ...aiResolvers,
}

export default Resolvers
