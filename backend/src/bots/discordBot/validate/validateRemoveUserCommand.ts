// Validate the array data for the caseRemoveUser message
export const validateRemoveUserCommand = (msgArr: string[]): string => {
  if (msgArr.length !== 2) {
    return "The !removeuser command must contain exactly two parts: `!removeuser <discord_username>`."
  }

  const [command] = msgArr

  if (command.toLowerCase() !== "!removeuser") {
    return `Invalid command \`${command}\`.`
  }

  return ""
}
