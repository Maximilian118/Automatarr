// Validate the array data for the caseDeleteUser message
export const validateDeleteUserCommand = (msgArr: string[]): string => {
  if (msgArr.length !== 2) {
    return "The !deleteuser command must contain exactly two parts: `!deleteuser <discord_username>`."
  }

  const [command] = msgArr

  if (command.toLowerCase() !== "!deleteuser") {
    return `Invalid command \`${command}\`.`
  }

  return ""
}
