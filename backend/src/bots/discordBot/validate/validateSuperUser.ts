// Validate the array data for the caseSuperUser message
export const validateSuperUser = (msgArr: string[]): string => {
  if (msgArr.length !== 3) {
    return "The !superuser command must contain exactly three parts: `!superuser <add/remove> <discord_username>`."
  }

  const [command, action] = msgArr

  if (command.toLowerCase() !== "!superuser") {
    return `Invalid command \`${command}\`.`
  }

  if (!["add", "remove"].includes(action?.toLowerCase())) {
    return `Invalid action \`${action}\`. Please use \`add\` or \`remove\`.`
  }

  return ""
}
