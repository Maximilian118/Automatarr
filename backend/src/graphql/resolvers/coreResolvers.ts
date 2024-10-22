import logger from "../../logger"
import { settingsType } from "../../models/settings"

const coreResolvers = {
  search_wanted_missing: async (settings: settingsType): Promise<void> => {
    logger.warn(settings)
  },
}

export default coreResolvers
