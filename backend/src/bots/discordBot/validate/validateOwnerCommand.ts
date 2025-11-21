// Validate the array data for the caseOwner message
export const validateOwnerCommand = (msgArr: string[]): string => {
  if (msgArr.length !== 2) {
    return "The !owner command must contain exactly two parts: `!owner <discord_username>`."
  }

  const [command] = msgArr

  if (command.toLowerCase() !== "!owner") {
    return `Invalid command \`${command}\`.`
  }

  return ""
}
