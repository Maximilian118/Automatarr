// Validate the array data for the caseStats message
export const validateCaseStats = (msgArr: string[]): string => {
  if (msgArr.length > 2) {
    return "The !stats command must contain no more than two parts: `!stats <optional_discord_username>`. If you'd like your own stats, simply type `!stats`."
  }

  const [command] = msgArr

  if (command.toLowerCase() !== "!stats") {
    return `Invalid command \`${command}\`.`
  }

  return ""
}
