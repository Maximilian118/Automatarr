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

// Validate the array data for the caseInit message
export const validateInitCommand = (msgArr: string[]): string => {
  const validCommands = ["!initialize", "!initialise", "!init"]

  if (msgArr.length !== 3) {
    return "The !init command must contain exactly three parts: `!init <discord_username> <display_name>`."
  }

  const [command, _, displayName] = msgArr

  if (!validCommands.includes(command.toLowerCase())) {
    return `Invalid command \`${command}\`. Use one of these: ${validCommands.join(", ")}.`
  }

  const displayNameRegex = /^[a-zA-Z]{1,20}$/
  if (!displayNameRegex.test(displayName)) {
    return `\`${displayName}\` is invalid. A display name must contain only letters and be no more than 20 characters long.`
  }

  return ""
}

// Validate the array data for the caseDelete message
export const validateDeleteCommand = (msgArr: string[]): string => {
  if (msgArr.length !== 2) {
    return "The !delete command must contain exactly two parts: `!delete <discord_username>`."
  }

  const [command] = msgArr

  if (command.toLowerCase() !== "!delete") {
    return `Invalid command \`${command}\`.`
  }

  return ""
}

// Validate the array data for the caseDelete message
export const validateRemoveCommand = (msgArr: string[]): string => {
  if (msgArr.length !== 2) {
    return "The !remove command must contain exactly two parts: `!remove <discord_username>`."
  }

  const [command] = msgArr

  if (command.toLowerCase() !== "!remove") {
    return `Invalid command \`${command}\`.`
  }

  return ""
}
