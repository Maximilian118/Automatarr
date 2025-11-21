// Validate the array data for the caseList message
export const validateListCommand = (msgArr: string[]): string => {
  const validContentTypes = ["pool", "movie", "movies", "series"]
  const unsupported = ["album", "albums", "book", "books"]

  if (msgArr.length > 3) {
    return "The !list command must contain no more than three parts: `!list <optional_contentType> <optional_discord_username>`."
  }

  const [command, ...rest] = msgArr

  if (command.toLowerCase() !== "!list") {
    return `Invalid command \`${command}\`.`
  }

  // Parse arguments more intelligently
  // Expected format: !list [contentType] [username] [basic]
  // Where contentType and username can be in any order after the command

  for (const arg of rest) {
    const argLower = arg.toLowerCase()

    // Skip "basic" flag and Discord usernames (both @username and <@id> formats)
    if (argLower === "basic" || arg.startsWith("@") || arg.match(/^<@!?\d+>$/)) {
      continue
    }

    // Check for unsupported types
    if (unsupported.includes(argLower)) {
      return `I do apologise. My maker hasn't programmed me for ${
        arg.endsWith("s") ? arg : arg + "s"
      } yet.`
    }

    // Check if it's a valid content type
    if (validContentTypes.includes(argLower)) {
      continue
    }

    // If we get here, it's an unrecognized argument that's not basic, @username, or valid content type
    return `Hmm.. I don't understand what you mean by ${arg}. Try ${validContentTypes.join(", ")}.`
  }

  return ""
}
