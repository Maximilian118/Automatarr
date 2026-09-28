import logger from "../logger"
import Settings, { settingsDocType } from "../models/settings"
import { sendRecommendation } from "../bots/discordBot/ai/aiRecommendations"

// Send at most one proactive AI recommendation to the user most overdue one
const bot_recommendations = async (): Promise<void> => {
  const settings = (await Settings.findOne()) as settingsDocType | null

  if (!settings) {
    logger.error("bot_recommendations | No settings found.")
    return
  }

  try {
    await sendRecommendation(settings)
  } catch (err) {
    logger.error(`bot_recommendations | Failed: ${err}`)
  }
}

export default bot_recommendations
