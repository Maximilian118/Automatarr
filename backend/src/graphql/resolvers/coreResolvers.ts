import { settingsType } from "../../models/settings"

const coreResolvers = {
  search_wanted_missing: async (settings: settingsType): Promise<void> => {
    console.log(settings)
  },
}

export default coreResolvers
