import { Channel, TextChannel, NewsChannel, ThreadChannel, DMChannel } from "discord.js"

export type SendableTextChannel = TextChannel | ThreadChannel | DMChannel | NewsChannel

export const isTextBasedChannel = (channel: Channel | null): SendableTextChannel | null => {
  if (
    channel instanceof TextChannel ||
    channel instanceof ThreadChannel ||
    channel instanceof DMChannel ||
    channel instanceof NewsChannel
  ) {
    return channel
  }

  return null
}
