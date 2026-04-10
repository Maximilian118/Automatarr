import Resolvers from "../graphql/resolvers/resolvers"
import { settingsDocType } from "../models/settings"
import { dynamicLoop } from "../shared/dynamicLoop"
import { collectStats } from "../shared/statsCollector"
import backups from "./backups"
import permissions_change from "./permissions_change"
import queue_cleaner from "./queue_cleaner"
import failed_cleanup from "./failed_cleanup"
import library_cleanup from "./library_cleanup"
import content_search from "./content_search"
import tidy_directories from "./tidy_directories"

// Start looping through all of the core loops
// prettier-ignore
export const coreLoops = async (skipFirst?: boolean): Promise<void> => {
  
  // Retrieve the latest API data and add to database
  await dynamicLoop("get_data", async () => {
    await Resolvers.getData()
    try {
      await collectStats()
    } catch (error) {
      console.error("ERROR in collectStats():", error)
    }
  }, true, 60)
  // Check for monitored content in libraries that has not been downloaded and is wanted missing.
  await dynamicLoop("content_search_loop", async (settings) => {
    await content_search(settings)
  }, skipFirst)
  // Check if any items in queues can not be automatically imported. If so, handle it depending on why.
  await dynamicLoop("queue_cleaner_loop", async (settings) => {
    await queue_cleaner(settings)
  }, skipFirst)
  // Check for any failed downloads and delete them from the file system.
  await dynamicLoop("failed_cleanup_loop", async (settings) => {
    await failed_cleanup(settings)
  }, skipFirst)
  // Note: user_pool_content_checker now runs at the end of getData to ensure fresh library data
  // Check for any failed downloads and delete them from the file system.
  await dynamicLoop("library_cleanup_loop", async (settings) => {
    await library_cleanup(settings)
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
  if (settings.content_search) {
    await content_search(settings._doc)
  }
  // Check if any items in queues can not be automatically imported. If so, handle it depending on why.
  if (settings.queue_cleaner) {
    await queue_cleaner(settings._doc)
  }
  // Check for any failed downloads and delete them from the file system.
  if (settings.failed_cleanup) {
    await failed_cleanup(settings._doc)
  }
  // Note: user_pool_content_checker now runs at the end of getData to ensure fresh library data
  // Note: storage_cleaner now runs at the end of getData to ensure fresh library data
  // Check for any failed downloads and delete them from the file system.
  if (settings.library_cleanup) {
    await library_cleanup(settings._doc)
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
