// Just a bit of fun so we don't see the same message everytime

import { Movie } from "../../types/movieTypes"

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

export const getStatusMessage = (status: string, time?: string): string => {
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

export const randomDownloadStartMessage = (movie: Movie) => {
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
