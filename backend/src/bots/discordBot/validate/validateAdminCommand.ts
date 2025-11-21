// Validate the array data for the caseAdmin message
export const validateAdminCommand = (msgArr: string[]): string => {
  if (msgArr.length !== 3) {
    return "The !admin command must contain exactly three parts: `!admin <add/remove> <discord_username>`."
  }

  const [command, action] = msgArr

  if (command.toLowerCase() !== "!admin") {
    return `Invalid command \`${command}\`.`
  }

  if (!["add", "remove"].includes(action?.toLowerCase())) {
    return `Invalid action \`${action}\`. Please use \`add\` or \`remove\`.`
  }

  return ""
}
