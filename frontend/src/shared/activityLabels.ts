import { Clapperboard, File, Folder, LibraryBig, ListX, LucideIcon, Magnet, Tv } from "lucide-react"
import { ActivityAction, ActivityItem } from "../types/activityType"

// Readable names for where a removal came from
const sourceNames: Record<string, string> = {
  library_cleanup: "Library Cleanup",
  queue_cleaner: "Queue Cleaner",
  failed_cleanup: "Failed Cleanup",
  tidy_directories: "Tidy Directories",
  storage_cleaner: "Storage Cleaner",
  content_search: "Content Search",
  permissions_change: "Permissions Change",
  backups: "Backups",
  discord: "Discord",
  manual: "Other",
}

// Turn a source key into a label, falling back to Title Case for anything new
export const sourceLabel = (source: string): string =>
  sourceNames[source] ??
  source
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ")

// Icon for each kind of removal
export const actionIcons: Record<ActivityAction, LucideIcon> = {
  file: File,
  folder: Folder,
  library: LibraryBig,
  torrent: Magnet,
  queue: ListX,
  movie_file: Clapperboard,
  episode_file: Tv,
}

// One sentence describing what was removed and from where
export const describeAction = (item: ActivityItem): string => {
  switch (item.action) {
    case "file":
      return "File deleted from disk"
    case "folder":
      return "Folder deleted from disk"
    case "library":
      return `Removed from ${item.app ?? "the library"} along with its files`
    case "torrent":
      return "Torrent and its data removed from qBittorrent"
    case "queue":
      return `Removed from the ${item.app ?? "download"} queue`
    case "movie_file":
      return "Movie file deleted so a better copy can be found"
    case "episode_file":
      return "Episode file deleted so a better copy can be found"
    default:
      return "Removed"
  }
}
