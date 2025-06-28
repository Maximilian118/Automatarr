import Resolvers from "../graphql/resolvers/resolvers"
import { settingsDocType } from "../models/settings"
import { dynamicLoop } from "../shared/dynamicLoop"
import backups from "./backups"
import permissions_change from "./permissions_change"
import remove_blocked from "./remove_blocked"
import remove_failed from "./remove_failed"
import remove_missing from "./remove_missing"
import search_wanted_missing from "./search_wanted_missing"
import tidy_directories from "./tidy_directories"

// Start looping through all of the core loops
// prettier-ignore
export const coreLoops = async (skipFirst?: boolean): Promise<void> => {
  // Retrieve the latest API data and add to database
  await dynamicLoop("get_data", async () => {
    await Resolvers.getData()
  }, true, 60)
  // Check for monitored content in libraries that has not been downloaded and is wanted missing.
  await dynamicLoop("wanted_missing_loop", async (settings) => {
    await search_wanted_missing(settings)
  }, skipFirst)
  // Check if any items in queues can not be automatically imported. If so, handle it depending on why.
  await dynamicLoop("remove_blocked_loop", async (settings) => {
    await remove_blocked(settings)
  }, skipFirst)
  // Check for any failed downloads and delete them from the file system.
  await dynamicLoop("remove_failed_loop", async (settings) => {
    await remove_failed(settings)
  }, skipFirst)
  // Check for any failed downloads and delete them from the file system.
  await dynamicLoop("remove_missing_loop", async (settings) => {
    await remove_missing(settings)
  }, skipFirst)
  // Remove all unwanted files and directories in the provided paths.
  await dynamicLoop("tidy_directories_loop", async (settings) => {
    await tidy_directories(settings)
  }, skipFirst)
  // Change ownership of Starr app root folders to users preference. (Useful to change ownership to Plex user)
  await dynamicLoop("permissions_change_loop", async (settings) => {
    await permissions_change(settings)
  }, skipFirst)
  // Backup the settings and user pool data
  await dynamicLoop("backups_loop", async (settings) => {
    await backups(settings)
  }, skipFirst)
}

// Call all core loop functions once
export const coreLoopsOnce = async (settings: settingsDocType): Promise<void> => {
  // Check for monitored content in libraries that has not been downloaded and is wanted missing.
  if (settings.wanted_missing) {
    await search_wanted_missing(settings._doc)
  }
  // Check if any items in queues can not be automatically imported. If so, handle it depending on why.
  if (settings.remove_blocked) {
    await remove_blocked(settings._doc)
  }
  // Check for any failed downloads and delete them from the file system.
  if (settings.remove_failed) {
    await remove_failed(settings._doc)
  }
  // Check for any failed downloads and delete them from the file system.
  if (settings.remove_missing) {
    await remove_missing(settings._doc)
  }
  // Remove all unwanted files and directories in the provided paths.
  if (settings.tidy_directories) {
    await tidy_directories(settings._doc)
  }
  // Change ownership of Starr app root folders to users preference. (Useful to change ownership to Plex user)
  if (settings.permissions_change) {
    await permissions_change(settings._doc)
  }
  // Backup the settings and user pool data
  if (settings.backups) {
    await backups(settings)
  }
}
