import { settingsType } from "../models/settings"
import logger from "../logger"
import { deleteFromMachine, getChildPaths } from "../shared/fileSystem"
import { counter, counterTracking } from "../shared/counter"

const tidy_directories = async (settings: settingsType): Promise<void> => {
  if (process.env.NODE_ENV === "development") {
    logger.info("tidyDirectories bypassed. In Development mode... risky stuff!")
    return
  }

  // Return if there are no paths and there's nothing to do
  if (settings.tidy_directories_paths.length === 0) {
    logger.warn("tidyDirectories: No paths found.")
    return
  }

  // An object for logging
  const tidying = {
    paths: 0,
    children: 0,
    allowed: 0,
    notAllowed: 0,
  }

  // Loop through all the paths we need to tidy
  for (const tidyPath of settings.tidy_directories_paths) {
    tidying.paths++
    const children = getChildPaths(tidyPath.path)

    // Loop through all of the children and check if each child is allowed
    for (const child of children) {
      tidying.children++
      const allowed = tidyPath.allowedDirs.some((d) => d === child)

      if (!allowed) {
        tidying.notAllowed++
        const requiredCount = 3

        const updatedCount = await counter(
          child,
          () => {
            deleteFromMachine(child)
          },
          requiredCount,
        )

        const loopsLeft = requiredCount - updatedCount

        if (requiredCount === updatedCount) {
          logger.success(`tidyDirectories: ${child} has been deleted from ${tidyPath.path}.`)
        } else {
          logger.warn(
            `${child} is not allowed in ${tidyPath.path} and will be deleted in ${loopsLeft} loop${
              loopsLeft === 1 ? "" : "s"
            }.`,
          )
        }
      } else {
        tidying.allowed++
        counterTracking.delete(child)
      }
    }
  }

  if (tidying.notAllowed === 0) {
    const singular = tidying.paths === 1
    logger.success(
      `tidyDirectories: All children are allowed out of ${tidying.children} children in ${
        tidying.paths
      } path${singular ? "" : "s"}.`,
    )
  }
}

export default tidy_directories
