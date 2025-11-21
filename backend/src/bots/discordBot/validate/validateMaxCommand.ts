// Validate the array data for the caseMax message
export const validateMaxCommand = (msgArr: string[]): string => {
  const validCommands = ["!maximum", "!max"]
  const contentTypes = ["movie", "movies", "series"]
  const unsupported = ["album", "albums", "book", "books"]

  if (msgArr.length !== 4) {
    return "The !maximum command must contain exactly four parts: `!maximum <contentType> <amount> <discord_username>`."
  }

  const [command, contentType, amount] = msgArr

  if (!validCommands.includes(command.toLowerCase())) {
    return `Invalid command \`${command}\`. Use one of these: ${validCommands.join(", ")}.`
  }

  if (unsupported.includes(contentType.toLowerCase())) {
    return `I do apologise. My maker hasn't programmed me for ${
      contentType.endsWith("s") ? contentType : contentType + "s"
    } yet.`
  }

  if (!contentTypes.includes(contentType.toLowerCase())) {
    return `Hmm.. I don't understand what you mean by ${contentType}. Try ${contentTypes.join(
      ", ",
    )}.`
  }

  const normalizedAmount = amount.toLowerCase()
  if (normalizedAmount !== "null" && !/^\d+$/.test(normalizedAmount)) {
    return "The 3rd <amount> argument must be a whole number or the word `null` to clear the limit."
  }

  return ""
}
