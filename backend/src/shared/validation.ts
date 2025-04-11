import logger from "../logger"

// Check a URL string
export const checkURL = (name: string, URL: string): boolean => {
  if (!URL) {
    logger.warn(`${name} | No URL set. Skipping...`)
    return true
  } else if (
    !/^((https?|ftp):\/\/)?((localhost|(\d{1,3}\.){3}\d{1,3})|(([a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}))(:(\d+))?(\/[^\s]*)?$/.test(
      URL,
    )
  ) {
    logger.warn(`${name} | URL invalid. Skipping...`)
    return true
  }

  return false
}

// Check a KEY for Starr apps
export const checkKEY = (name: string, KEY: string): boolean => {
  if (!KEY) {
    logger.warn(`${name} | No KEY set. Skipping...`)
    return true
  } else if (!/^[a-fA-F0-9]{32}$/.test(KEY)) {
    logger.warn(`${name} | KEY invalid. Skipping...`)
    return true
  }

  return false
}

// Check for validation issues for Starr fields
export const checkStarr = (name: string, URL: string, KEY: string): boolean => {
  if (!URL && !KEY) {
    logger.warn(`${name} | No Settings. Skipping...`)
    return true
  }

  if (checkURL(name, URL)) {
    return true
  }

  if (checkKEY(name, KEY)) {
    return true
  }

  return false
}
