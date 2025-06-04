// Just a bit of fun so we don't see the same message everytime

import { Movie } from "../../types/movieTypes"
import { Series } from "../../types/seriesTypes"

export const randomMovieReadyMessage = (name: string, movieTitle: string) => {
  const messages = [
    `Hey ${name}, '${movieTitle}' has finished downloading! Ready to watch. 🍿`,
    `You're good to go, ${name} — '${movieTitle}' is ready for viewing! 🎬`,
    `Download complete, ${name}! '${movieTitle}' is queued up and waiting. 📽️`,
    `${name}, '${movieTitle}' is all set. Press play and enjoy! ▶️`,
    `Enjoy the show, ${name} — '${movieTitle}' is now available! 🎉`,
    `${name}, '${movieTitle}' is in the library. Let movie night begin! 🌙`,
    `'${movieTitle}' just landed, ${name}. Fire it up when you're ready! 🚀`,
    `Done and dusted! '${movieTitle}' is ready to roll, ${name}. 🛋️`,
    `Hey ${name}, '${movieTitle}' is downloaded and waiting. Snacks not included. 🍿`,
  ]
  return messages[Math.floor(Math.random() * messages.length)]
}

export const randomSeriesReadyMessage = (name: string, seriesTitle: string) => {
  const messages = [
    `Hey ${name}, '${seriesTitle}' just finished downloading! Time to binge! 📺`,
    `Good news, ${name} — '${seriesTitle}' is ready and waiting! 🍿`,
    `Episodes are in, ${name}! '${seriesTitle}' is ready to stream. 🎬`,
    `${name}, '${seriesTitle}' is all set. Grab a blanket and dive in! 🛋️`,
    `All downloaded, ${name} — '${seriesTitle}' is in your library now! ✅`,
    `Get comfy, ${name}. '${seriesTitle}' is prepped and ready for your next session. 🛏️`,
    `'${seriesTitle}' is ready to roll, ${name}. Happy watching! 🎉`,
    `${name}, '${seriesTitle}' has landed. Let the marathon begin! 🏁`,
    `Binge mode: activated. '${seriesTitle}' is ready for you, ${name}! 🔥`,
  ]
  return messages[Math.floor(Math.random() * messages.length)]
}

export const randomMovieStillNotDownloadedMessage = (movieTitle: string) => {
  const messages = [
    `'${movieTitle}' is still not marked as downloaded after waiting four hours. I'd contact the server owner if I were you.`,
    `No sign of '${movieTitle}' after four hours. Something might be stuck. 🤔`,
    `'${movieTitle}' hasn't finished downloading... and it's been a while. Might want to check in with the server admin.`,
    `Four hours later and still no '${movieTitle}'. Something's up. 🚨`,
    `Hmm, '${movieTitle}' is taking its sweet time. It might need a little human intervention.`,
    `'${movieTitle}' is still missing in action. Recommend contacting the server overlord.`,
    `Still waiting on '${movieTitle}' after four hours. Might be worth kicking the server (gently).`,
    `'${movieTitle}' should be here by now. It's probably stuck in the tubes. 🛠️`,
  ]
  return messages[Math.floor(Math.random() * messages.length)]
}

export const randomSeriesStillNotDownloadedMessage = (
  seriesTitle: string,
  timeleft?: string,
): string => {
  const baseMessages = [
    `'${seriesTitle}' still hasn't downloaded after four hours. You might want to give the server admin a nudge.`,
    `No luck with '${seriesTitle}' after four hours. Something might be jammed.`,
    `'${seriesTitle}' is still stuck in limbo. It's probably time to check on the server.`,
    `Four hours in and '${seriesTitle}' is still missing. Might be worth investigating.`,
    `Hmm... '${seriesTitle}' didn't make it through. Server might need some attention.`,
    `'${seriesTitle}' is fashionably late. Too fashionably. Someone should check the pipeline.`,
    `'${seriesTitle}' is still MIA after four hours. Might be time to reboot something.`,
    `Still no '${seriesTitle}' after a full shift. Maybe the server took a nap.`,
    `'${seriesTitle}' didn't make the cut-off. Give the server overlord a gentle prod.`,
  ]

  const message = baseMessages[Math.floor(Math.random() * baseMessages.length)]

  return timeleft ? `${message} (Last episode finishes downloading in: ${timeleft})` : message
}

export const randomProcessingMessage = () => {
  const messages = [
    "Hold on a sec...",
    "Strap in!",
    "Just a moment while I work my magic...",
    "Hang tight, doing some wizardry 🧙‍♂️",
    "Crunching the numbers...",
    "One sec, contacting the media gods 📡",
    "Gimme a moment — lining everything up...",
    "Booting up the content engine... 🔧",
    "Working on it — don’t go anywhere!",
    "Stand by... automation in progress 🤖",
  ]
  return messages[Math.floor(Math.random() * messages.length)]
}

export const randomNotFoundMessage = () => {
  const messages = [
    "Hmm... I couldn't find that one.",
    "No luck finding it, sorry!",
    "I looked, but came up empty.",
    "That's not showing up for me.",
    "I couldn't track that down.",
    "I didn't see anything matching that.",
    "Couldn't find it — maybe double-check the title or year?",
    "That one's not popping up. Got another title?",
    "Nothing came up on my end — want to try again?",
  ]
  return messages[Math.floor(Math.random() * messages.length)]
}

export const randomAlreadyAddedMessage = () => {
  const messages = [
    "You've already got that one — try to keep up!",
    "Nice try, but that's already in your stash.",
    "That one's been downloaded already, champ.",
    "Check your collection, genius!",
    "You've added that before. Memory like a goldfish?",
    "Old news! You've already grabbed that.",
    "Yep, you've got that one. Impressive attention to detail... not.",
  ]
  return messages[Math.floor(Math.random() * messages.length)]
}

const randomQueuedMessage = (timeLeft?: string) => {
  const time = timeLeft ? ` (ETA: ${timeLeft})` : ""
  const messages = [
    `Your request is queued — waiting for its turn to download${time}.`,
    `It's in line to be downloaded${time}. Hang tight.`,
    `That one's queued${time}. We'll grab it as soon as we can.`,
    `Added to the download queue${time}. Shouldn't be long now.`,
    `Waiting in the queue${time} — we haven't forgotten it.`,
  ]
  return messages[Math.floor(Math.random() * messages.length)]
}

const randomDownloadingMessage = (timeLeft?: string) => {
  const time = timeLeft ? ` (ETA: ${timeLeft})` : ""
  const messages = [
    `It's downloading right now${time} — progress is happening.`,
    `Currently being downloaded${time}. You'll have it soon.`,
    `Download in progress${time}. Just a little longer.`,
    `We're on it — that one's coming down as we speak${time}.`,
    `It's actively downloading${time}. Almost there.`,
  ]
  return messages[Math.floor(Math.random() * messages.length)]
}

const randomPausedMessage = () => {
  const messages = [
    "The download is paused. Only the server overlord can bring it back to life.",
    "Download currently paused — you'll need to ask the mighty server owner to resume it.",
    "It's on hold. Only the chosen one (a.k.a. the server owner) can unpause it.",
    "Download paused. Summon the server god if you want it moving again.",
    "This one's in stasis. Only the keeper of the server keys can release it.",
  ]
  return messages[Math.floor(Math.random() * messages.length)]
}

const randomCompletedMessage = () => {
  const messages = [
    "The download is complete but still stuck in the queue. Only the mighty server owner can investigate and bring it home.",
    "Download's done, but something's holding it back. Time to alert the server deity.",
    "It finished downloading, but hasn't moved forward. The server overlord must intervene.",
    "Complete, yet unmoved — like a warrior waiting for orders. Summon the server god to finish the job.",
    "It's downloaded but not imported. Only the great server owner can descend from the clouds and fix this.",
  ]
  return messages[Math.floor(Math.random() * messages.length)]
}

const randomImportedMessage = () => {
  const messages = [
    "All done. It's downloaded and added to your library.",
    "Finished and imported — it should be ready to watch.",
    "Successfully added to your collection.",
    "That one's now part of your library. Enjoy.",
    "It's in — check your collection. You're good to go.",
  ]
  return messages[Math.floor(Math.random() * messages.length)]
}

const randomFailedMessage = () => {
  const messages = [
    "The download failed. Might be a broken link or bad source.",
    "That one didn't go through. Try another release.",
    "Download failed — something went wrong with the process.",
    "No luck — the download crashed or couldn't complete.",
    "Something broke. That download didn't make it.",
  ]
  return messages[Math.floor(Math.random() * messages.length)]
}

const randomWarningMessage = () => {
  const messages = [
    "There's a warning on this one — might be a quality issue.",
    "Download succeeded, but the server isn't fully happy with it.",
    "It's flagged with a warning. Maybe double-check it.",
    "the server thinks something's off — might be worth a second look.",
    "That one came with a warning. Could still be fine, but be cautious.",
  ]
  return messages[Math.floor(Math.random() * messages.length)]
}

export const getMovieStatusMessage = (status: string, time?: string): string => {
  switch (status.toLowerCase()) {
    case "queued":
      return randomQueuedMessage(time)
    case "downloading":
      return randomDownloadingMessage(time)
    case "paused":
      return randomPausedMessage()
    case "completed":
      return randomCompletedMessage()
    case "imported":
      return randomImportedMessage()
    case "failed":
      return randomFailedMessage()
    case "warning":
      return randomWarningMessage()
    default:
      return "I'm not quite sure what's going on with this one. Might be time to ask the server guru."
  }
}

export const randomMovieDownloadStartMessage = (movie: Movie) => {
  const messages = [
    `Popcorn ready? '${movie.title}' is on its way! 🍿`,
    `Download started for '${movie.title}' — time to get cozy! 🎬`,
    `Here comes the magic! '${movie.title}' is rolling in. ✨`,
    `'${movie.title}' is downloading — movie night is officially ON! 🔥`,
    `Hold onto your seats, '${movie.title}' is arriving! 🚀`,
    `You're in for a treat — '${movie.title}' is downloading now! 🍭`,
    `The reels are turning! '${movie.title}' is coming your way. 🎞️`,
    `'${movie.title}' is en route! Let the cinematic vibes begin. 🛤️`,
    `Cheers! '${movie.title}' is being summoned from the movie gods. 🍷🎥`,
    `'${movie.title}' is downloading — excellent choice, by the way. 😎`,
  ]
  return messages[Math.floor(Math.random() * messages.length)]
}

export const randomSeriesDownloadStartMessage = (series: Series) => {
  const messages = [
    `Binge mode: activated! '${series.title}' is on the way. 📺`,
    `Here we go — '${series.title}' is starting to download! 🍿`,
    `'${series.title}' is joining the library. Get comfy! 🛋️`,
    `Episodes inbound! '${series.title}' is downloading now. 🚚`,
    `Get ready for a wild ride — '${series.title}' is coming in hot! 🔥`,
    `One episode at a time... '${series.title}' is on the move! 🎬`,
    `'${series.title}' is headed your way. It's series time! 📦`,
    `Cue the theme song — '${series.title}' is downloading. 🎵`,
    `'${series.title}' is loading up. Snacks not included. 🍪`,
    `📡 Incoming transmission: '${series.title}' has entered the download zone.`,
  ]
  return messages[Math.floor(Math.random() * messages.length)]
}

export const randomAlreadyAddedWithMissingMessage = () => {
  const messages = [
    "The series is in the library, but a few episodes wandered off — I'm tracking them down now.",
    "Found it in the library! Some episodes are missing, but I've kicked off a search.",
    "That one's already here, but incomplete — fetching the missing pieces!",
    "The show's in your library, but it's got holes. I'm working on patching it up.",
    "Library hit confirmed! Some episodes are MIA, initiating recovery mission.",
    "It's already in the collection, just not all there — starting a search for the missing bits.",
    "That series made it in, but a few episodes didn't — I'm on the case!",
    "It's here, but not whole. Missing episodes detected — search engaged!",
  ]
  return messages[Math.floor(Math.random() * messages.length)]
}

export const randomMissingEpisodesSearchInProgress = () => {
  const messages = [
    "The series is in the library, but a few episodes are missing. Already on the case!",
    "Some episodes are MIA, but don't worry—I'm chasing them down as we speak.",
    "It's in your collection, just a bit incomplete. I've already started fetching the missing bits!",
    "The show’s here, but not whole. Retrieval in progress!",
    "Found the series with a few holes. Don’t panic—I’m filling in the gaps!",
    "The library’s got it, but it's not all there. I’m working on getting the rest!",
    "Looks like the series is here but patchy. Already started a recovery mission!",
    "It’s on the shelf, minus a few chapters. I’m hunting them down for you!",
  ]
  return messages[Math.floor(Math.random() * messages.length)]
}

export const randomEpisodesDownloadingMessage = (count: number) => {
  const messages = [
    `I'm already downloading ${count} episode${
      count > 1 ? "s" : ""
    } for that series. They're coming!`,
    `${count} episode${count > 1 ? "s" : ""} are already on their way — sit tight!`,
    `Hang tight! I'm already fetching ${count} episode${count > 1 ? "s" : ""}.`,
    `Already working on it — ${count} episode${count > 1 ? "s" : ""} are in the pipe.`,
    `No need to worry, ${count} episode${count > 1 ? "s" : ""} are already being downloaded.`,
    `I'm already on it! ${count} episode${count > 1 ? "s" : ""} are currently downloading.`,
    `This series is already in the library. ${count} episode${
      count > 1 ? "s" : ""
    } are being grabbed now.`,
    `Already added! ${count} episode${count > 1 ? "s" : ""} are coming your way.`,
  ]
  return messages[Math.floor(Math.random() * messages.length)]
}

export const randomPositiveComment = (mention: string): string => {
  const messages = [
    `${mention}, you're leveling up! 📈`,
    `Whoa ${mention}, look at that new max! 🚀`,
    `More to love, ${mention}. Enjoy! 🍿`,
    `You're moving up in the world, ${mention}! 🙌`,
    `Limit? What limit? Go wild, ${mention}! 🎉`,
    `You're unstoppable now, ${mention}! 🏆`,
  ]
  return messages[Math.floor(Math.random() * messages.length)]
}

export const randomSadComment = (mention: string): string => {
  const messages = [
    `Aw, ${mention}... your wings have been clipped. 🥲`,
    `Someone's on a limit diet... sorry ${mention}! 🍽️`,
    `Back to basics, ${mention}. 😔`,
    `The binge must wait, ${mention}. 📉`,
    `Cutbacks hit hard, huh ${mention}? 💸`,
    `Less is more... or is it? 😬 Sorry, ${mention}.`,
  ]
  return messages[Math.floor(Math.random() * messages.length)]
}

export const randomRemovalSuccessMessage = (poolItemTitle: string, contentType: string): string => {
  const messages = [
    `I've removed \`${poolItemTitle}\` from your ${contentType} pool. More space for fun!`,
    `Gone! \`${poolItemTitle}\` has been booted from your ${contentType} stash.`,
    `Tossed \`${poolItemTitle}\` out of your ${contentType} collection. Fresh start vibes!`,
    `\`${poolItemTitle}\` is history. Your ${contentType} pool just got lighter.`,
    `Snip snip ✂️ — \`${poolItemTitle}\` has been cut from your ${contentType} lineup.`,
    `Out with the old! \`${poolItemTitle}\` no longer lives in your ${contentType} list.`,
    `Declutter mode: activated. \`${poolItemTitle}\` is gone from your ${contentType} zone.`,
    `I've banished \`${poolItemTitle}\` from your ${contentType} pool. May it rest in pieces.`,
    `\`${poolItemTitle}\`? Never heard of it. It's out of your ${contentType} pool!`,
  ]
  return messages[Math.floor(Math.random() * messages.length)]
}
