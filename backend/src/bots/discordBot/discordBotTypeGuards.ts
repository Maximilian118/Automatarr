import { Channel, TextChannel, NewsChannel, ThreadChannel, DMChannel } from "discord.js"
import type { TextBasedChannel } from "discord.js"

export const isTextBasedChannel = (channel: Channel): channel is TextBasedChannel => {
  return (
    channel instanceof TextChannel ||
    channel instanceof NewsChannel ||
    channel instanceof ThreadChannel ||
    channel instanceof DMChannel
  )
}
