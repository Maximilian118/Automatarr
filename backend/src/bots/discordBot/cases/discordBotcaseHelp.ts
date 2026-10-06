import { Message } from "discord.js"
import Settings, { settingsDocType } from "../../../models/settings"
import { sendDiscordMessage } from "../discordBotUtility"

type CommandEntry = {
  name: string
  aliases?: string[]
  category: "General" | "User Management" | "Content" | "Discover"
  shortDescription: string
  description?: string
  usage: string
  adminRequired: boolean | "Owner"
  requires?: "plex" // Only listed when this optional connection is set up
}

const commandRegistry: CommandEntry[] = [
  {
    name: "!ping",
    category: "General",
    shortDescription: "Check responsiveness",
    usage: "!ping",
    adminRequired: false,
  },
  {
    name: "!hello",
    category: "General",
    shortDescription: "Say Hello!",
    usage: "!hello",
    adminRequired: false,
  },
  {
    name: "!help",
    category: "General",
    shortDescription: "Provides command information",
    usage: "!help <optional !command/category>",
    adminRequired: false,
  },
  {
    name: "!owner",
    category: "User Management",
    shortDescription: "Assign the server owner",
    description: "This command is quite final, so think very carefully before using it.",
    usage: "!owner <discord_username>",
    adminRequired: "Owner",
  },
  {
    name: "!admin",
    category: "User Management",
    shortDescription: "Add or remove admin privileges",
    description: "Admins can manage users and have unlimited downloads.",
    usage: "!admin <add/remove> <discord_username>",
    adminRequired: true,
  },
  {
    name: "!superuser",
    category: "User Management",
    shortDescription: "Add or remove Super User privileges",
    description: "Super Users get double the default pool size.",
    usage: "!superuser <add/remove> <discord_username>",
    adminRequired: true,
  },
  {
    name: "!maximum",
    aliases: ["`!max`"],
    category: "User Management",
    shortDescription: "Set an overwrite for a user's pool maximum",
    description: "Overrides default and Super User limits. Use `null` for unlimited.",
    usage: "!max <contentType> <amount|null> <discord_username>",
    adminRequired: true,
  },
  {
    name: "!initialise",
    aliases: ["`!init`"],
    category: "User Management",
    shortDescription: "Initialise a new user",
    description: "Creates a new pool in the Automatarr database for the targeted user.",
    usage: "!init <discord_username> <display_name>",
    adminRequired: true,
  },
  {
    name: "!deleteuser",
    category: "User Management",
    shortDescription: "Delete a user pool",
    description: "Remove content for this user but keep them in the Discord server.",
    usage: "!deleteuser <discord_username>",
    adminRequired: true,
  },
  {
    name: "!removeuser",
    category: "User Management",
    shortDescription: "Entirely remove a user",
    description: "Remove content for this user and remove them from the Discord server.",
    usage: "!removeuser <discord_username>",
    adminRequired: true,
  },
  {
    name: "!stats",
    category: "User Management",
    shortDescription: "Display the stats of a user",
    description:
      "Display the general stats of a user. Add a Discord username to target someone else.",
    usage: "!stats <optional_discord_username>",
    adminRequired: false,
  },
  {
    name: "!list",
    category: "User Management",
    shortDescription: "List a user's pool items",
    description:
      "List content in a user's pool. ContentType = pool / movies / series. Add a Discord username to target someone else.",
    usage: "!list <optional_contentType> <optional_discord_username>",
    adminRequired: false,
  },
  {
    name: "!download",
    aliases: ["`!d`"],
    category: "Content",
    shortDescription: "Download content",
    description: `Download content and add it to your pool. Optionally, specify a quality and/or a monitor option in any order after the year. Use "!help Quality" for quality options and "!help Monitor" for monitor options.`,
    usage: "!download <title + year> <optional_quality> <optional_monitor>",
    adminRequired: false,
  },
  {
    name: "!remove",
    category: "Content",
    shortDescription: "Remove content",
    description:
      "Remove content from your pool. The !list command is handy to help choose what you'd like to remove.",
    usage: "!remove <Index/Title + Year>",
    adminRequired: false,
  },
  {
    name: "!blocklist",
    aliases: ["`!dud`"],
    category: "Content",
    shortDescription: "Replace content",
    description: "Mark a download as problematic, delete it and replace it with a different file.",
    usage: "!blocklist <movieTitle Year> or !blocklist <seriesTitle Year SxxEyy>",
    adminRequired: false,
  },
  {
    name: "!waittime",
    aliases: ["`!wait`", "`!time`"],
    category: "Content",
    shortDescription: "Download Time",
    description: "Check how long it will take for content in the queue to download.",
    usage: "!wait <movieTitle + Year / seriesTitle + Year>",
    adminRequired: false,
  },
  {
    name: "!stay",
    category: "Content",
    shortDescription: "Keep content downloaded",
    description: "Ensure some content isn't deleted by adding it to your user pool.",
    usage: "!stay <movieTitle + Year / seriesTitle + Year>",
    adminRequired: false,
  },
  {
    name: "!monitor",
    category: "Content",
    shortDescription: "Change a series monitoring options",
    description:
      'Update monitoring options for a series. Upgrading (e.g., pilot → all) is always allowed. Downgrading (e.g., all → pilot) requires you to be the only user with the series AND it must not be in any import list. Use "!help Monitor" for monitoring options.',
    usage: "!monitor <seriesTitle + Year> <monitor_option>",
    adminRequired: false,
  },
  {
    name: "!search",
    aliases: ["`!find`"],
    category: "Content",
    shortDescription: "Search user pools for content",
    description: "Find which users have specific content in their pools. Use with or without year.",
    usage: "!search <movieTitle + optional Year / seriesTitle + optional Year>",
    adminRequired: false,
  },
  {
    name: "!test",
    category: "User Management",
    shortDescription: "Test download notifications",
    description:
      "Generate test download notifications for testing purposes. Uses random content from database.",
    usage: "!test <downloading|ready|upgrade|expired>",
    adminRequired: true,
  },
  {
    name: "!private",
    category: "User Management",
    shortDescription: "Hide or share your Plex watch history",
    description:
      "When on, your watch history and taste are kept out of public replies like !list, !stats and !search, and out of popularity counts. Use with no option to see your current setting.",
    usage: "!private <on/off>",
    adminRequired: false,
  },
  {
    name: "!recommend",
    category: "Discover",
    shortDescription: "Get picks from the server you haven't seen",
    description:
      "Recommends downloaded films or series you haven't watched, requested or added, ranked by your taste. Optionally name a type and a genre, e.g. !recommend sci-fi movies.",
    usage: "!recommend <optional movies/series> <optional genre>",
    adminRequired: false,
  },
  {
    name: "!popular",
    category: "Discover",
    shortDescription: "What's been watched most this month",
    description: "The most watched titles on the server this month, by how many people watched them.",
    usage: "!popular <optional movies/series>",
    adminRequired: false,
    requires: "plex",
  },
]

// Whether a command can be used with the connections that are set up
const commandAvailable = (cmd: CommandEntry, settings: settingsDocType | null): boolean =>
  cmd.requires !== "plex" || !!settings?.plex_active

const renderCommandHelp = (cmd: CommandEntry): string =>
  `\`${cmd.name}\`${cmd.aliases ? `, ${cmd.aliases.join(", ")}` : ""} - ${cmd.shortDescription}\n` +
  `Usage: \`${cmd.usage}\`\n` +
  `Admin Required: ${
    cmd.adminRequired === "Owner" ? "Owner" : cmd.adminRequired ? "Yes" : "No"
  }\n` +
  `${cmd.description ? `Description: ${cmd.description}\n` : ""}`

// Get help for the command a user typed (by name or alias), or every non-admin command if it's unknown
export const commandUsageHelp = (typedCommand: string): string => {
  const typed = typedCommand.toLowerCase()
  const match = commandRegistry.find(
    (cmd) => cmd.name === typed || cmd.aliases?.some((alias) => alias.replace(/`/g, "") === typed),
  )

  if (match) return renderCommandHelp(match)

  return commandRegistry
    .filter((cmd) => !cmd.adminRequired)
    .map(renderCommandHelp)
    .join("\n")
}

const categoryHeaders: Record<string, string> = {
  General: "📚   **General Commands**",
  "User Management": "🎛️   **User Management**",
  Content: "🎬   **Content Commands**",
  Discover: "🍿   **Discover**",
}

const renderSection = (category: string, settings: settingsDocType | null): string => {
  const header = categoryHeaders[category] || `**${category} Commands**`
  const sectionCommands = commandRegistry.filter((cmd) => cmd.category === category && commandAvailable(cmd, settings))
  return `${header}\n\n` + sectionCommands.map(renderCommandHelp).join("\n")
}

export const caseHelp = async (message: Message): Promise<void> => {
  const settings = (await Settings.findOne()) as settingsDocType | null
  const msgArr = message.content.trim().split(/\s+/)
  const [command, query] = msgArr

  if (command.toLowerCase() !== "!help") {
    sendDiscordMessage(message, `Invalid command \`${command}\`.`)
    return
  }

  // Check for "!help Monitor"
  if (query && query.toLowerCase() === "monitor") {
    const monitorOptionsMessage =
      `**Series Monitoring Options:**\n\n` +
      `Monitoring controls how much of a series gets downloaded. By default, all episodes are downloaded. Use these options with !download or !monitor to choose which episodes you want.\n\n` +
      `**All** - Monitor all episodes except specials\n` +
      `**Future** - Monitor episodes that have not aired yet\n` +
      `**Missing** - Monitor episodes that do not have files or have not aired yet\n` +
      `**Existing** - Monitor episodes that have files or have not aired yet\n` +
      `**Recent** - Monitor episodes aired within the last 90 days and future episodes\n` +
      `**Pilot** - Only monitor the first episode of the first season\n` +
      `**FirstSeason** - Monitor all episodes of the first season. All other seasons will be ignored\n` +
      `**LastSeason** - Monitor all episodes of the last season\n` +
      `**MonitorSpecials** - Monitor all special episodes without changing the monitored status of other episodes\n` +
      `**UnmonitorSpecials** - Unmonitor all special episodes without changing the monitored status of other episodes`
    sendDiscordMessage(message, monitorOptionsMessage)
    return
  }

  // Check for "!help Quality"
  if (query && query.toLowerCase() === "quality") {
    const qualityOptionsMessage =
      `**Quality Options for !download:**\n\n` +
      `Add a quality option after the year to override the default quality profile.\n` +
      `Quality and monitor options can be used together in any order.\n\n` +
      `**4K / Ultra HD:** 4k, 2160p, 2160, uhd, ultra\n` +
      `**1080p / Full HD:** 1080p, 1080, fhd, fullhd\n` +
      `**720p / HD:** 720p, 720\n` +
      `**480p / SD:** 480p, 480, sd\n\n` +
      `**Examples:**\n` +
      `\`!download Breaking Bad 2008 4k\`\n` +
      `\`!download Firefly 2002 1080p future\`\n` +
      `\`!download Top Gun 1986 uhd\``
    sendDiscordMessage(message, qualityOptionsMessage)
    return
  }

  if (!query) {
    sendDiscordMessage(message, "**🤖   All Available Commands**")
    sendDiscordMessage(message, "\u200B")
    sendDiscordMessage(message, renderSection("General", settings))
    sendDiscordMessage(message, "\u200B")
    sendDiscordMessage(message, renderSection("User Management", settings))
    sendDiscordMessage(message, "\u200B")
    sendDiscordMessage(message, renderSection("Content", settings))
    sendDiscordMessage(message, "\u200B")
    sendDiscordMessage(message, renderSection("Discover", settings))
    return
  }

  if (!query.includes("!") && query.includes("general")) {
    sendDiscordMessage(message, renderSection("General", settings))
    return
  }

  if (!query.includes("!") && query.includes("user")) {
    sendDiscordMessage(message, renderSection("User Management", settings))
    return
  }

  if (!query.includes("!") && query.includes("content")) {
    sendDiscordMessage(message, renderSection("Content", settings))
    return
  }

  if (!query.includes("!") && query.toLowerCase().includes("discover")) {
    sendDiscordMessage(message, renderSection("Discover", settings))
    return
  }

  // Try match by name or alias
  const lowerQuery = query.toLowerCase()
  const found = commandRegistry.find(
    (cmd) =>
      cmd.name.toLowerCase() === lowerQuery ||
      (cmd.aliases && cmd.aliases.map((a) => a.toLowerCase()).includes(lowerQuery)),
  )

  if (found) {
    sendDiscordMessage(message, renderCommandHelp(found))
    return
  }

  sendDiscordMessage(
    message,
    `Hmm.. I don't understand what you mean by ${query}. Try "general", "user management", "content" or "discover".`,
  )
}
